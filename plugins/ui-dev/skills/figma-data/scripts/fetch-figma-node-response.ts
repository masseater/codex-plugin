#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { getToken } from "./_lib.ts";

type FigmaNodeResponse = {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
  nodes: Record<string, { document: unknown; components?: unknown; schemaVersion?: number }>;
};

async function fetchNode(fileKey: string, nodeId: string): Promise<FigmaNodeResponse> {
  const token = getToken();

  const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
  url.searchParams.set("ids", nodeId);

  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma API request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  return (await response.json()) as FigmaNodeResponse;
}

const main = defineCommand({
  meta: {
    name: "fetch-figma-node-response",
    description: "Fetch a single Figma node and print the raw API response as JSON",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID (colon or dash format)",
      required: true,
    },
  },
  async run({ args }) {
    const result = await fetchNode(args["file-key"], args["node-id"]);
    console.log(JSON.stringify(result, null, 2));
  },
});

runMain(main);
