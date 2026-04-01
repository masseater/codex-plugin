#!/usr/bin/env bun

import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { defineCommand, runMain } from "citty";
import { getToken } from "./_lib.ts";

const main = defineCommand({
  meta: {
    name: "dump-raw-response",
    description: "Fetch the FULL raw Figma API response (no filtering) and save to a file",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID (colon or dash format). If omitted, fetches the entire file.",
    },
    output: {
      type: "string",
      description: "Output JSON file path",
      required: true,
    },
    geometry: {
      type: "boolean",
      description: "Include vector geometry paths (geometry=paths)",
      default: false,
    },
    "plugin-data": {
      type: "string",
      description:
        'Plugin data to include (comma-separated plugin IDs, or "shared" for shared plugin data)',
    },
    depth: {
      type: "string",
      description: "Depth of node tree to return (number). Omit for full depth.",
    },
  },
  async run({ args }) {
    const token = getToken();
    const fileKey = args["file-key"];
    const nodeId = args["node-id"];
    const outputPath = args.output;
    const geometry = args.geometry as boolean;
    const pluginData = args["plugin-data"];
    const depth = args.depth;

    let url: URL;

    if (nodeId) {
      // Node-level endpoint
      url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
      url.searchParams.set("ids", nodeId);
    } else {
      // Full file endpoint
      url = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    }

    if (geometry) {
      url.searchParams.set("geometry", "paths");
    }
    if (pluginData) {
      url.searchParams.set("plugin_data", pluginData);
    }
    if (depth) {
      url.searchParams.set("depth", depth);
    }

    console.error(`[INFO] Fetching: ${url.toString()}`);

    const res = await fetch(url, {
      headers: { "X-Figma-Token": token },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Figma API failed: ${res.status} ${res.statusText}\n${body}`);
    }

    const raw = await res.json();

    await mkdir(dirname(outputPath), { recursive: true });
    await Bun.write(outputPath, JSON.stringify(raw, null, 2));

    // Print summary stats
    const json = JSON.stringify(raw);
    console.error(`[INFO] Response size: ${(json.length / 1024).toFixed(1)} KB`);
    console.error(`[INFO] Saved to: ${outputPath}`);

    // Print top-level keys for quick overview
    if (typeof raw === "object" && raw !== null) {
      console.error(`[INFO] Top-level keys: ${Object.keys(raw).join(", ")}`);
    }

    console.log(`output=${outputPath}`);
  },
});

runMain(main);
