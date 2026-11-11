#!/usr/bin/env bun

import { join } from "node:path";
import { defineCommand, runMain } from "citty";
import { imageUrls } from "./_json.ts";
import { downloadFile, figmaJson, getToken, log } from "./_lib.ts";

async function fetchImageUrls(
  fileKey: string,
  nodeIds: string[],
  format: string,
  scale: number,
  token: string,
): Promise<Record<string, string | null>> {
  const svgParams = format === "svg" ? { svg_include_id: "true", svg_simplify_stroke: "true" } : {};
  const data = await figmaJson(
    ["images", fileKey],
    { ids: nodeIds.join(","), format, scale: String(scale), ...svgParams },
    token,
    "Figma Images API",
  );
  return imageUrls(data);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

type ExportedImage = { nodeId: string; path: string };

/**
 * 画像の URL から各ノードの画像を保存する。URL の無いノードは警告して飛ばす。
 * @param images ノード ID から画像 URL への対応
 * @param outputDir 保存先のディレクトリ
 * @param format 画像の形式（拡張子に使う）
 * @param verbose デバッグログを出すか
 * @returns 保存した画像
 */
async function downloadImages(
  images: Record<string, string | null>,
  outputDir: string,
  format: string,
  verbose: boolean,
): Promise<ExportedImage[]> {
  const results: ExportedImage[] = [];
  for (const [nodeId, imageUrl] of Object.entries(images)) {
    if (!imageUrl) {
      console.error(`[WARN] No image URL for node ${nodeId}`);
      continue;
    }
    const outputPath = join(outputDir, `${sanitizeFilename(nodeId)}.${format}`);
    log(verbose, `[DEBUG] Downloading ${nodeId} -> ${outputPath}`);
    await downloadFile(imageUrl, outputPath);
    results.push({ nodeId, path: outputPath });
  }
  return results;
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
    const verbose = args.verbose;
    const format = args.format;
    const scale = Number.parseFloat(args.scale);
    const nodeIds = args["node-ids"].split(",").map((id) => id.trim());
    const outputDir = args["output-dir"];

    log(verbose, `[DEBUG] Exporting ${nodeIds.length} node(s) as ${format}...`);

    const images = await fetchImageUrls(args["file-key"], nodeIds, format, scale, token);

    const results = await downloadImages(images, outputDir, format, verbose);

    console.log(`exported=${results.length} format=${format} outputDir=${outputDir}`);
    for (const r of results) {
      console.log(`  ${r.nodeId} -> ${r.path}`);
    }
  },
});

await runMain(main);
