#!/usr/bin/env bun
/**
 * Save a Figma node screenshot to a file via REST API.
 */

import { defineCommand, runMain } from "citty";
import { env } from "../../../env.js";
import { parseFigmaImagesResponse } from "../../../lib/figma-schemas.js";
import { downloadFile, figmaGet, toColon } from "./_lib.ts";

type ExportResult = {
  success: boolean;
  outputPath: string;
  nodeId: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

/**
 * Images API でノードの画像 URL を取得する。
 * @param fileKey Figma のファイルキー
 * @param apiNodeId コロン区切りのノード ID
 * @param token Figma のアクセストークン
 * @param options 画像の形式と倍率
 * @returns 画像の URL
 */
async function imageUrlFor(
  fileKey: string,
  apiNodeId: string,
  token: string,
  options: { format: string; scale: number },
): Promise<string> {
  const metaRes = await figmaGet(
    ["images", fileKey],
    { ids: apiNodeId, format: options.format, scale: String(options.scale) },
    token,
  );
  if (!metaRes.ok) {
    throw new Error(`Figma API ${metaRes.status}: ${await metaRes.text()}`);
  }

  const meta = parseFigmaImagesResponse(await metaRes.json());
  if (meta.err) {
    throw new Error(`Figma API error: ${meta.err}`);
  }

  const imageUrl = meta.images[apiNodeId];
  if (!imageUrl) {
    throw new Error(
      `No image URL returned for node ${apiNodeId}. Available keys: ${Object.keys(meta.images).join(", ")}`,
    );
  }
  return imageUrl;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const FORMATS = new Set(["png", "jpg", "svg", "pdf"]);

function printResult(result: ExportResult): void {
  console.log(JSON.stringify(result, null, 2));
}

/**
 * 失敗を JSON で出力し、exit code 1 で終了する。
 * @param outputPath 出力ファイルのパス
 * @param nodeId ノード ID
 * @param error 失敗の理由
 */
function fail(outputPath: string, nodeId: string, error: string): never {
  printResult({ success: false, outputPath, nodeId, error });
  process.exit(1);
}

function exportOptions(args: { scale?: string | undefined; format?: string | undefined }): {
  scale: number;
  format: string;
} {
  return { scale: args.scale ? Number(args.scale) : 1, format: args.format ?? "png" };
}

function optionError(options: { scale: number; format: string }): string | undefined {
  if (options.scale < 0.01 || options.scale > 4) return "Scale must be between 0.01 and 4";
  if (!FORMATS.has(options.format)) {
    return `Unsupported format: ${options.format}. Use png, jpg, svg, or pdf`;
  }
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const main = defineCommand({
  meta: {
    name: "export-screenshot",
    description: "Export a Figma node as a screenshot via REST API",
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
      description: "Export scale 0.01-4 (default: 1)",
      required: false,
    },
    format: {
      type: "string",
      description: "Image format: png, jpg, svg, pdf (default: png)",
      required: false,
    },
  },
  async run({ args }) {
    const nodeId = args["node-id"];
    const outputPath = args.output;
    const options = exportOptions(args);

    const invalid = optionError(options);
    if (invalid) fail(outputPath, nodeId, invalid);

    const token = env.FIGMA_ACCESS_TOKEN;
    if (!token) fail(outputPath, nodeId, "FIGMA_ACCESS_TOKEN environment variable is not set");

    try {
      const imageUrl = await imageUrlFor(args["file-key"], toColon(nodeId), token, options);
      await downloadFile(imageUrl, outputPath);
      printResult({ success: true, outputPath, nodeId });
    } catch (error) {
      fail(outputPath, nodeId, errorMessage(error));
    }
  },
});

await runMain(main);
