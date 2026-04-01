#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { getToken, log } from "./_lib.ts";

type FigmaDocument = {
  id: string;
  name: string;
  type: string;
  children?: FigmaDocument[];
};

type FigmaFileResponse = {
  name: string;
  lastModified: string;
  version: string;
  document: FigmaDocument;
};

async function fetchFileTree(fileKey: string, token: string): Promise<FigmaFileResponse> {
  const url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
  url.searchParams.set("depth", "2");

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    throw new Error(`Figma API failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as FigmaFileResponse;
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
    const verbose = args.verbose as boolean;

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

runMain(main);
