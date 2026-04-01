#!/usr/bin/env bun
/**
 * Save a Figma node screenshot to a file.
 * Prefers REST API (FIGMA_ACCESS_TOKEN), falls back to Desktop MCP on failure.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { defineCommand, runMain } from "citty";
import { env } from "../../../env.js";

const MCP_URL = "http://127.0.0.1:3845/mcp";

type ExportResult = {
  success: boolean;
  outputPath: string;
  nodeId: string;
  method?: "rest-api" | "desktop-mcp";
  fallback?: boolean;
  error?: string;
};

type McpResponse<T> = {
  result?: T;
  error?: { code: number; message: string };
  jsonrpc: string;
  id: number;
};

type GetScreenshotResult = {
  content: Array<{
    type: string;
    data?: string;
    mimeType?: string;
    text?: string;
  }>;
};

type FigmaImagesResponse = {
  err: string | null;
  images: Record<string, string | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFigmaImagesResponse(value: unknown): value is FigmaImagesResponse {
  return isRecord(value) && "images" in value && isRecord(value.images);
}

function isMcpResponse<T>(value: unknown): value is McpResponse<T> {
  return isRecord(value) && "jsonrpc" in value;
}

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

function nodeIdToApiFormat(nodeId: string): string {
  return nodeId.replace(/-/g, ":");
}

async function exportViaRestApi(
  fileKey: string,
  nodeId: string,
  token: string,
  format: string,
  scale: number,
): Promise<Buffer> {
  const apiNodeId = nodeIdToApiFormat(nodeId);
  const url = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(apiNodeId)}&format=${format}&scale=${scale}`;

  const metaRes = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });
  if (!metaRes.ok) {
    const text = await metaRes.text();
    throw new Error(`Figma API ${metaRes.status}: ${text}`);
  }

  const raw: unknown = await metaRes.json();
  if (!isFigmaImagesResponse(raw)) {
    throw new Error("Figma API: unexpected response format");
  }
  const meta = raw;
  if (meta.err) {
    throw new Error(`Figma API error: ${meta.err}`);
  }

  const imageUrl = meta.images[apiNodeId];
  if (!imageUrl) {
    throw new Error(
      `No image URL returned for node ${apiNodeId}. Available keys: ${Object.keys(meta.images).join(", ")}`,
    );
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Image download failed: ${imgRes.status}`);
  }

  return Buffer.from(await imgRes.arrayBuffer());
}

// ---------------------------------------------------------------------------
// Desktop MCP
// ---------------------------------------------------------------------------

let sessionId: string | null = null;

async function callMcp<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    ...(params && { params }),
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };

  if (sessionId) {
    headers["mcp-session-id"] = sessionId;
  }

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP request failed: ${response.status} - ${text}`);
  }

  const newSessionId = response.headers.get("mcp-session-id");
  if (newSessionId) {
    sessionId = newSessionId;
  }

  const text = await response.text();

  const lines = text.split("\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const parsed: unknown = JSON.parse(line.slice(6));
      if (!isMcpResponse<T>(parsed)) {
        throw new Error("MCP: unexpected response format");
      }
      const data = parsed;
      if (data.error) {
        throw new Error(`MCP error: ${data.error.message}`);
      }
      if (data.result !== undefined) {
        return data.result;
      }
    }
  }

  throw new Error("No result in MCP response");
}

async function initializeMcp(): Promise<void> {
  await callMcp("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "figma-screenshot", version: "1.0.0" },
  });
}

async function getScreenshot(fileKey: string, nodeId: string): Promise<string> {
  const result = await callMcp<GetScreenshotResult>("tools/call", {
    name: "get_screenshot",
    arguments: {
      file_key: fileKey,
      node_id: nodeId,
    },
  });

  const imageContent = result.content.find((c) => c.type === "image" && c.data && c.mimeType);

  if (!imageContent?.data) {
    const errorContent = result.content.find((c) => c.type === "text");
    throw new Error(errorContent?.text ?? "No image data returned");
  }

  return imageContent.data;
}

async function exportViaMcp(fileKey: string, nodeId: string): Promise<Buffer> {
  await initializeMcp();
  const base64Data = await getScreenshot(fileKey, nodeId);
  return Buffer.from(base64Data, "base64");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const main = defineCommand({
  meta: {
    name: "export-screenshot",
    description: "Export a Figma node as a screenshot (REST API + Desktop MCP fallback)",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID to export (e.g., 1:234 or 1-234)",
      required: true,
    },
    output: {
      type: "string",
      description: "Output file path",
      required: true,
    },
    scale: {
      type: "string",
      description: "Export scale 0.01-4 (REST API only, default: 1)",
      required: false,
    },
    format: {
      type: "string",
      description: "Image format: png, jpg, svg, pdf (REST API only, default: png)",
      required: false,
    },
  },
  async run({ args }) {
    const fileKey = args["file-key"];
    const nodeId = args["node-id"];
    const outputPath = args.output;
    const scale = args.scale ? Number(args.scale) : 1;
    const format = args.format ?? "png";

    if (scale < 0.01 || scale > 4) {
      const result: ExportResult = {
        success: false,
        outputPath,
        nodeId,
        error: "Scale must be between 0.01 and 4",
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    if (!["png", "jpg", "svg", "pdf"].includes(format)) {
      const result: ExportResult = {
        success: false,
        outputPath,
        nodeId,
        error: `Unsupported format: ${format}. Use png, jpg, svg, or pdf`,
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    try {
      let buffer: Buffer;
      let method: ExportResult["method"];
      let fallback = false;

      const token = env.FIGMA_ACCESS_TOKEN;

      if (token) {
        try {
          buffer = await exportViaRestApi(fileKey, nodeId, token, format, scale);
          method = "rest-api";
        } catch (apiError) {
          console.error(
            `[REST API failed, falling back to Desktop MCP] ${apiError instanceof Error ? apiError.message : String(apiError)}`,
          );
          buffer = await exportViaMcp(fileKey, nodeId);
          method = "desktop-mcp";
          fallback = true;
        }
      } else {
        buffer = await exportViaMcp(fileKey, nodeId);
        method = "desktop-mcp";
      }

      const dir = dirname(outputPath);
      await mkdir(dir, { recursive: true });
      await writeFile(outputPath, buffer);

      const result: ExportResult = {
        success: true,
        outputPath,
        nodeId,
        method,
        ...(fallback && { fallback }),
      };
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      const result: ExportResult = {
        success: false,
        outputPath,
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      };
      console.log(JSON.stringify(result, null, 2));
      process.exit(1);
    }
  },
});

runMain(main);
