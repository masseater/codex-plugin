#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { readJsonRecord, type JsonRecord } from "./_json.ts";
import { figmaGet, getToken } from "./_lib.ts";

async function fetchNode(fileKey: string, nodeId: string): Promise<JsonRecord> {
  const token = getToken();

  const response = await figmaGet(["files", fileKey, "nodes"], { ids: nodeId }, token);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma API request failed: ${response.status} ${response.statusText}\n${body}`);
  }

  return readJsonRecord(response);
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

await runMain(main);
