#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import * as v from "valibot";
import { figmaJson, getToken, log } from "./_lib.ts";

const FigmaFrameSchema = v.looseObject({
  id: v.string(),
  name: v.string(),
  type: v.string(),
});

const FigmaPageSchema = v.looseObject({
  id: v.string(),
  name: v.string(),
  children: v.optional(v.array(FigmaFrameSchema)),
});

/** GET /v1/files/:key?depth=2 のレスポンスのうち、このスクリプトが読む部分 */
const FigmaFileResponseSchema = v.looseObject({
  name: v.string(),
  lastModified: v.string(),
  version: v.string(),
  document: v.looseObject({
    children: v.optional(v.array(FigmaPageSchema)),
  }),
});

async function fetchFileTree(
  fileKey: string,
  token: string,
): Promise<v.InferOutput<typeof FigmaFileResponseSchema>> {
  const data = await figmaJson(["files", fileKey], { depth: "2" }, token, "Figma API");
  return v.parse(FigmaFileResponseSchema, data);
}

const main = defineCommand({
  meta: {
    name: "list-file-frames",
    description: "List all pages and top-level frames in a Figma file",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    output: {
      type: "string",
      description: "Output JSON file path (optional, prints to stdout if omitted)",
      required: false,
    },
    verbose: {
      type: "boolean",
      description: "Enable debug logging to stderr",
      default: false,
    },
  },
  async run({ args }) {
    const token = getToken();
    const fileKey = args["file-key"];
    const verbose = args.verbose;

    log(verbose, `[DEBUG] Fetching file tree for ${fileKey}...`);

    const file = await fetchFileTree(fileKey, token);

    log(verbose, `[DEBUG] File: ${file.name}, version: ${file.version}`);

    const pages = file.document.children ?? [];
    let totalFrames = 0;

    const result = {
      meta: {
        fileKey,
        fileName: file.name,
        lastModified: file.lastModified,
        totalPages: pages.length,
        totalFrames: 0,
        fetchedAt: new Date().toISOString(),
      },
      pages: pages.map((page) => {
        const frames = (page.children ?? []).map((child) => {
          totalFrames++;
          return {
            id: child.id,
            name: child.name,
            type: child.type,
          };
        });
        log(verbose, `[DEBUG] Page "${page.name}": ${frames.length} frames`);
        return {
          id: page.id,
          name: page.name,
          frames,
        };
      }),
    };

    result.meta.totalFrames = totalFrames;

    const json = JSON.stringify(result, null, 2);

    if (args.output) {
      await Bun.write(args.output, json);
      console.log(`totalPages=${pages.length} totalFrames=${totalFrames} output=${args.output}`);
    } else {
      console.log(json);
    }
  },
});

await runMain(main);
