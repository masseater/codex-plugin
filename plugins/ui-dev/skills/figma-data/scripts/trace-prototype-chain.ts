#!/usr/bin/env bun

import { dirname, join } from "node:path";
import { defineCommand, runMain } from "citty";
import { downloadFile, getToken, toColon, toDash } from "./_lib.ts";

type FigmaNodeResponse = {
  name: string;
  lastModified: string;
  version: string;
  nodes: Record<string, { document: Record<string, unknown> | null }>;
};

type Interaction = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  trigger: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
};

type FigmaImagesResponse = {
  err: string | null;
  images: Record<string, string | null>;
};

type FrameEntry = {
  id: string;
  name: string;
  type: string;
  screenshot?: string;
  interactions: Interaction[];
};

/** Fetch multiple nodes in a single API call. */
async function fetchNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
  retries = 3,
): Promise<{
  nodes: Record<string, Record<string, unknown> | null>;
  fileName: string;
}> {
  const url = new URL(`https://api.figma.com/v1/files/${fileKey}/nodes`);
  url.searchParams.set("ids", nodeIds.join(","));

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, {
      headers: { "X-Figma-Token": token },
    });

    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "5", 10);
      const wait = Math.max(retryAfter, 2) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch nodes ${nodeIds.join(",")}: ${res.status}`);
    }

    const data = (await res.json()) as FigmaNodeResponse;
    const result: Record<string, Record<string, unknown> | null> = {};
    for (const id of nodeIds) {
      const colonId = toColon(id);
      result[colonId] = data.nodes[colonId]?.document ?? null;
    }
    return { nodes: result, fileName: data.name };
  }

  throw new Error(`Exhausted retries for nodes ${nodeIds.join(",")}`);
}

async function fetchImageUrls(
  fileKey: string,
  nodeIds: string[],
  token: string,
): Promise<Record<string, string | null>> {
  const url = new URL(`https://api.figma.com/v1/images/${fileKey}`);
  url.searchParams.set("ids", nodeIds.join(","));
  url.searchParams.set("format", "png");
  url.searchParams.set("scale", "1");

  const res = await fetch(url, {
    headers: { "X-Figma-Token": token },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma Images API failed: ${res.status} ${body}`);
  }

  const data = (await res.json()) as FigmaImagesResponse;
  if (data.err) {
    throw new Error(`Figma Images API error: ${data.err}`);
  }

  return data.images;
}

/** Walk a node tree and collect both interactions and BFS destination IDs
 * in a single pass.
 *
 * Destination collection note: The /v1/files/:key/nodes endpoint returns
 * `destinationId: null` in `interactions[].actions[]` even when a prototype
 * connection exists. The legacy `transitionNodeID` field is the only reliable
 * source of destination IDs on this endpoint, so we use it as the primary
 * source and fall back to `interactions` destinationId where available.
 */
function collectNodeData(
  node: Record<string, unknown>,
  interactions: Interaction[],
  destinations: Set<string>,
): void {
  // Destinations: primary source is legacy transitionNodeID
  const transitionNodeID = node.transitionNodeID as string | undefined;
  if (transitionNodeID) {
    destinations.add(toColon(transitionNodeID));
  }

  // Destinations + Interactions from interactions[]
  const nodeInteractions = node.interactions as Array<Record<string, unknown>> | undefined;
  if (nodeInteractions && nodeInteractions.length > 0) {
    for (const ix of nodeInteractions) {
      interactions.push({
        nodeId: (node.id as string | undefined) ?? "",
        nodeName: (node.name as string) ?? "",
        nodeType: (node.type as string) ?? "",
        trigger: (ix.trigger as Record<string, unknown>) ?? {},
        actions: (ix.actions as Array<Record<string, unknown>>) ?? [],
      });

      const actions = ix.actions as Array<Record<string, unknown>> | undefined;
      if (actions) {
        for (const action of actions) {
          if (!action) continue;
          const destId = action.destinationId as string | null | undefined;
          if (destId) destinations.add(toColon(destId));
        }
      }
    }
  }

  const children = node.children as Array<Record<string, unknown>> | undefined;
  if (children) {
    for (const child of children) {
      collectNodeData(child, interactions, destinations);
    }
  }
}

const main = defineCommand({
  meta: {
    name: "trace-prototype-chain",
    description:
      "BFS-traverse a Figma prototype graph and build a complete page map with all interactions",
  },
  args: {
    "file-key": {
      type: "string",
      description: "Figma file key (from URL path)",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Starting node ID (colon or dash format)",
      required: true,
    },
    output: {
      type: "string",
      description: "Output JSON file path",
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
    const fileKey = args["file-key"];
    const startNodeId = args["node-id"];
    const outputPath = args.output;
    const verbose = args.verbose as boolean;
    const log = (msg: string) => {
      if (verbose) console.error(msg);
    };

    log(`[DEBUG] Starting prototype graph trace from ${startNodeId}...`);

    const frames: Record<string, FrameEntry> = {};
    const visited = new Set<string>();
    let pending = [toDash(startNodeId)];
    let figmaFileName = "";
    let fetchCount = 0;
    const NODE_BATCH_SIZE = 10;

    // Level-by-level BFS: fetch all nodes in current level as batches,
    // then collect all new destinations for the next level.
    while (pending.length > 0) {
      // Deduplicate and filter already-visited
      const levelIds = [...new Set(pending)].map(toColon).filter((id) => !visited.has(id));
      pending = [];
      if (levelIds.length === 0) continue;

      for (let i = 0; i < levelIds.length; i += NODE_BATCH_SIZE) {
        const batch = levelIds.slice(i, i + NODE_BATCH_SIZE);
        for (const id of batch) visited.add(id);

        fetchCount += batch.length;
        log(`[DEBUG] Fetching batch of ${batch.length} nodes (total: ${fetchCount})`);

        const { nodes, fileName } = await fetchNodes(fileKey, batch.map(toDash), token);

        if (!figmaFileName) figmaFileName = fileName;

        for (const colonId of batch) {
          const document = nodes[colonId];
          if (!document) {
            log(`[DEBUG] Node ${colonId} resolved to null, skipping.`);
            continue;
          }

          const docId = toColon((document.id as string) ?? colonId);
          const interactions: Interaction[] = [];
          const destinations = new Set<string>();
          collectNodeData(document, interactions, destinations);

          frames[docId] = {
            id: docId,
            name: (document.name as string) ?? "",
            type: (document.type as string) ?? "",
            interactions,
          };

          for (const dest of destinations) {
            if (!visited.has(dest)) {
              pending.push(toDash(dest));
            }
          }
        }

        // Rate limiting between batches
        if (i + NODE_BATCH_SIZE < levelIds.length) {
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      // Brief pause between BFS levels
      if (pending.length > 0) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    // Fetch and save screenshots
    const frameIds = Object.keys(frames);
    const screenshotDir = join(dirname(outputPath), "screenshots");
    log(`[DEBUG] Fetching screenshots for ${frameIds.length} frames...`);

    // Batch in chunks of 10 to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < frameIds.length; i += BATCH_SIZE) {
      const batch = frameIds.slice(i, i + BATCH_SIZE);
      const dashIds = batch.map(toDash);

      log(`[DEBUG] Screenshot batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} frames`);
      const imageUrls = await fetchImageUrls(fileKey, dashIds, token);

      for (const [nodeId, imageUrl] of Object.entries(imageUrls)) {
        if (!imageUrl) {
          log(`[DEBUG] No screenshot URL for ${nodeId}`);
          continue;
        }

        const colonId = toColon(nodeId);
        const safeName = toDash(colonId);
        const filePath = join(screenshotDir, `${safeName}.png`);

        await downloadFile(imageUrl, filePath);
        const frame = frames[colonId];
        if (frame) {
          frame.screenshot = filePath;
        }
        log(`[DEBUG] Saved screenshot: ${filePath}`);
      }

      if (i + BATCH_SIZE < frameIds.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const output = {
      meta: {
        fileKey,
        startNodeId: toColon(startNodeId),
        figmaFileName,
        totalFrames: Object.keys(frames).length,
        fetchedAt: new Date().toISOString(),
      },
      frames,
    };

    await Bun.write(outputPath, JSON.stringify(output, null, 2));
    log(`[DEBUG] Graph complete: ${output.meta.totalFrames} frames.`);
    log(`[DEBUG] Output written to ${outputPath}`);
    console.log(`totalFrames=${output.meta.totalFrames} output=${outputPath}`);
  },
});

runMain(main);
