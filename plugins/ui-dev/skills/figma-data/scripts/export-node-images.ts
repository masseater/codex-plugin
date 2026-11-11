#!/usr/bin/env bun

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { downloadFile, getToken, log } from "./_lib.ts";

type FigmaImagesResponse = {
  err: string | null;
  images: Record<string, string | null>;
};

async function fetchImageUrls(
  fileKey: string,
  nodeIds: string[],
  format: string,
  scale: number,
  token: string,
): Promise<Record<string, string | null>> {
  const url = new URL(`https://api.figma.com/v1/images/${fileKey}`);
  url.searchParams.set("ids", nodeIds.join(","));
  url.searchParams.set("format", format);
  url.searchParams.set("scale", String(scale));
  if (format === "svg") {
    url.searchParams.set("svg_include_id", "true");
    url.searchParams.set("svg_simplify_stroke", "true");
  }

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    throw new Error(`Figma Images API failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as FigmaImagesResponse;
  if (data.err) {
    throw new Error(`Figma Images API error: ${data.err}`);
  }

  return data.images;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const main = defineCommand({
  meta: {
    name: "export-node-images",
    description: "Export Figma nodes as SVG or PNG images via the Images API",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-ids": {
      type: "string",
      description: "Comma-separated node IDs to export",
      required: true,
    },
    format: {
      type: "string",
      description: "Export format: svg, png, jpg, pdf (default: svg)",
      default: "svg",
    },
    scale: {
      type: "string",
      description: "Scale factor for raster formats (default: 2)",
      default: "2",
    },
    "output-dir": {
      type: "string",
      description: "Directory to save exported files",
      required: true,
    },
    verbose: {
      type: "boolean",
      description: "Enable debug logging to stderr",
      default: false,
    },
  },
  async run({ args }) {
    const token = getToken();
    const verbose = args.verbose as boolean;
    const format = args.format as string;
    const scale = Number.parseFloat(args.scale as string);
    const nodeIds = (args["node-ids"] as string).split(",").map((id) => id.trim());
    const outputDir = args["output-dir"] as string;

    log(verbose, `[DEBUG] Exporting ${nodeIds.length} node(s) as ${format}...`);

    const images = await fetchImageUrls(args["file-key"], nodeIds, format, scale, token);

    const results: Array<{ nodeId: string; path: string }> = [];

    for (const [nodeId, imageUrl] of Object.entries(images)) {
      if (!imageUrl) {
        console.error(`[WARN] No image URL for node ${nodeId}`);
        continue;
      }

      const safeName = sanitizeFilename(nodeId);
      const ext = format === "svg" ? "svg" : format;
      const outputPath = join(outputDir, `${safeName}.${ext}`);

      log(verbose, `[DEBUG] Downloading ${nodeId} -> ${outputPath}`);
      await downloadFile(imageUrl, outputPath);
      results.push({ nodeId, path: outputPath });
    }

    console.log(`exported=${results.length} format=${format} outputDir=${outputDir}`);
    for (const r of results) {
      console.log(`  ${r.nodeId} -> ${r.path}`);
    }
  },
});

runMain(main);
