#!/usr/bin/env bun

import { dirname, join } from "node:path";
import { defineCommand, runMain } from "citty";
import {
  imageUrls,
  nodeDocument,
  readJsonRecord,
  recordArrayField,
  recordField,
  stringField,
  type JsonRecord,
} from "./_json.ts";
import { downloadFile, figmaGet, getToken, log, toColon, toDash } from "./_lib.ts";

type Interaction = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  trigger: JsonRecord;
  actions: Array<JsonRecord>;
};

type FrameEntry = {
  id: string;
  name: string;
  type: string;
  screenshot?: string;
  interactions: Interaction[];
};

const NODE_BATCH_SIZE = 10;
const SCREENSHOT_BATCH_SIZE = 10;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

function text(node: JsonRecord, key: string): string {
  return stringField(node, key) ?? "";
}

/** レート制限（429）の Retry-After から待ち時間を決める（最低 2 秒） */
function retryDelayMs(res: Response): number {
  const retryAfter = Number.parseInt(res.headers.get("retry-after") ?? "5", 10);
  return Math.max(retryAfter, 2) * 1000;
}

function nodesResult(
  data: JsonRecord,
  nodeIds: string[],
): { nodes: Record<string, JsonRecord | null>; fileName: string } {
  return {
    nodes: Object.fromEntries(nodeIds.map((id) => [toColon(id), nodeDocument(data, toColon(id))])),
    fileName: text(data, "name"),
  };
}

/** Fetch multiple nodes in a single API call. */
async function fetchNodes(
  fileKey: string,
  nodeIds: string[],
  token: string,
  retries = 3,
): Promise<{
  nodes: Record<string, JsonRecord | null>;
  fileName: string;
}> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await figmaGet(["files", fileKey, "nodes"], { ids: nodeIds.join(",") }, token);
    if (res.status === 429) {
      await sleep(retryDelayMs(res));
      continue;
    }
    if (!res.ok) {
      throw new Error(`Failed to fetch nodes ${nodeIds.join(",")}: ${res.status}`);
    }
    return nodesResult(await readJsonRecord(res), nodeIds);
  }

  throw new Error(`Exhausted retries for nodes ${nodeIds.join(",")}`);
}

async function fetchImageUrls(
  fileKey: string,
  nodeIds: string[],
  token: string,
): Promise<Record<string, string | null>> {
  const res = await figmaGet(
    ["images", fileKey],
    { ids: nodeIds.join(","), format: "png", scale: "1" },
    token,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma Images API failed: ${res.status} ${body}`);
  }

  return imageUrls(await readJsonRecord(res));
}

function interactionOf(node: JsonRecord, ix: JsonRecord): Interaction {
  return {
    nodeId: text(node, "id"),
    nodeName: text(node, "name"),
    nodeType: text(node, "type"),
    trigger: recordField(ix, "trigger") ?? {},
    actions: recordArrayField(ix, "actions") ?? [],
  };
}

/**
 * ノードの interactions を集め、その遷移先をあわせて記録する。
 * @param node ノード
 * @param interactions 集めた interaction（追記する）
 * @param destinations 遷移先のノード ID（追記する）
 */
function recordInteractions(
  node: JsonRecord,
  interactions: Interaction[],
  destinations: Set<string>,
): void {
  for (const ix of recordArrayField(node, "interactions") ?? []) {
    const interaction = interactionOf(node, ix);
    interactions.push(interaction);
    addDestinations(interaction.actions, destinations);
  }
}

function addDestinations(actions: JsonRecord[], destinations: Set<string>): void {
  for (const action of actions) {
    const destId = stringField(action, "destinationId");
    if (destId) destinations.add(toColon(destId));
  }
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
  node: JsonRecord,
  interactions: Interaction[],
  destinations: Set<string>,
): void {
  // Destinations: primary source is legacy transitionNodeID
  const transitionNodeID = stringField(node, "transitionNodeID");
  if (transitionNodeID) {
    destinations.add(toColon(transitionNodeID));
  }

  // Destinations + Interactions from interactions[]
  recordInteractions(node, interactions, destinations);

  for (const child of recordArrayField(node, "children") ?? []) {
    collectNodeData(child, interactions, destinations);
  }
}

type TraceContext = {
  fileKey: string;
  token: string;
  debug: (msg: string) => void;
  frames: Record<string, FrameEntry>;
  visited: Set<string>;
  figmaFileName: string;
  fetchCount: number;
};

/**
 * 取得したノードを frame として記録し、まだ訪れていない遷移先を返す。
 * @param ctx 探索の状態
 * @param colonId コロン区切りのノード ID
 * @param document ノードの document（取得できなければ null）
 * @returns 次に訪れるノード ID（ダッシュ区切り）
 */
function recordFrame(ctx: TraceContext, colonId: string, document: JsonRecord | null): string[] {
  if (!document) {
    ctx.debug(`[DEBUG] Node ${colonId} resolved to null, skipping.`);
    return [];
  }

  const docId = toColon(stringField(document, "id") ?? colonId);
  const interactions: Interaction[] = [];
  const destinations = new Set<string>();
  collectNodeData(document, interactions, destinations);

  ctx.frames[docId] = {
    id: docId,
    name: text(document, "name"),
    type: text(document, "type"),
    interactions,
  };
  return [...destinations].filter((dest) => !ctx.visited.has(dest)).map(toDash);
}

async function traceBatch(ctx: TraceContext, batch: string[]): Promise<string[]> {
  for (const id of batch) ctx.visited.add(id);

  ctx.fetchCount += batch.length;
  ctx.debug(`[DEBUG] Fetching batch of ${batch.length} nodes (total: ${ctx.fetchCount})`);

  const { nodes, fileName } = await fetchNodes(ctx.fileKey, batch.map(toDash), ctx.token);
  ctx.figmaFileName ||= fileName;
  return batch.flatMap((colonId) => recordFrame(ctx, colonId, nodes[colonId] ?? null));
}

/**
 * BFS の 1 階層分のノードを、まとめて取得しながら記録する。
 * @param ctx 探索の状態
 * @param levelIds この階層のノード ID（コロン区切り、未訪問のもの）
 * @returns 次の階層で訪れるノード ID（ダッシュ区切り）
 */
async function traceLevel(ctx: TraceContext, levelIds: string[]): Promise<string[]> {
  const next: string[] = [];
  const batches = chunks(levelIds, NODE_BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    next.push(...(await traceBatch(ctx, batch)));
    // Rate limiting between batches
    if (index < batches.length - 1) await sleep(500);
  }
  return next;
}

// Level-by-level BFS: fetch all nodes in current level as batches,
// then collect all new destinations for the next level.
async function traceFrames(ctx: TraceContext, startNodeId: string): Promise<void> {
  let pending = [toDash(startNodeId)];
  while (pending.length > 0) {
    // Deduplicate and filter already-visited
    const levelIds = [...new Set(pending)].map(toColon).filter((id) => !ctx.visited.has(id));
    pending = await traceLevel(ctx, levelIds);
    // Brief pause between BFS levels
    if (pending.length > 0) await sleep(300);
  }
}

/**
 * 1 枚のスクリーンショットを保存し、frame に保存先を記録する。
 * @param ctx 探索の状態
 * @param screenshotDir 保存先のディレクトリ
 * @param nodeId ノード ID
 * @param imageUrl 画像の URL（描画できなかったノードは null）
 */
async function saveScreenshot(
  ctx: TraceContext,
  screenshotDir: string,
  nodeId: string,
  imageUrl: string | null,
): Promise<void> {
  if (!imageUrl) {
    ctx.debug(`[DEBUG] No screenshot URL for ${nodeId}`);
    return;
  }

  const colonId = toColon(nodeId);
  const filePath = join(screenshotDir, `${toDash(colonId)}.png`);
  await downloadFile(imageUrl, filePath);
  const frame = ctx.frames[colonId];
  if (frame) frame.screenshot = filePath;
  ctx.debug(`[DEBUG] Saved screenshot: ${filePath}`);
}

// Fetch and save screenshots
async function saveScreenshots(ctx: TraceContext, outputPath: string): Promise<void> {
  const frameIds = Object.keys(ctx.frames);
  const screenshotDir = join(dirname(outputPath), "screenshots");
  ctx.debug(`[DEBUG] Fetching screenshots for ${frameIds.length} frames...`);

  // Batch in chunks of 10 to avoid rate limits
  const batches = chunks(frameIds, SCREENSHOT_BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    ctx.debug(`[DEBUG] Screenshot batch ${index + 1}: ${batch.length} frames`);
    const urlsByNodeId = await fetchImageUrls(ctx.fileKey, batch.map(toDash), ctx.token);
    for (const [nodeId, imageUrl] of Object.entries(urlsByNodeId)) {
      await saveScreenshot(ctx, screenshotDir, nodeId, imageUrl);
    }
    if (index < batches.length - 1) await sleep(1000);
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
    const startNodeId = args["node-id"];
    const outputPath = args.output;
    const ctx: TraceContext = {
      fileKey: args["file-key"],
      token: getToken(),
      debug: (msg) => log(args.verbose, msg),
      frames: {},
      visited: new Set(),
      figmaFileName: "",
      fetchCount: 0,
    };

    ctx.debug(`[DEBUG] Starting prototype graph trace from ${startNodeId}...`);
    await traceFrames(ctx, startNodeId);
    await saveScreenshots(ctx, outputPath);

    const output = {
      meta: {
        fileKey: ctx.fileKey,
        startNodeId: toColon(startNodeId),
        figmaFileName: ctx.figmaFileName,
        totalFrames: Object.keys(ctx.frames).length,
        fetchedAt: new Date().toISOString(),
      },
      frames: ctx.frames,
    };

    await Bun.write(outputPath, JSON.stringify(output, null, 2));
    ctx.debug(`[DEBUG] Graph complete: ${output.meta.totalFrames} frames.`);
    ctx.debug(`[DEBUG] Output written to ${outputPath}`);
    console.log(`totalFrames=${output.meta.totalFrames} output=${outputPath}`);
  },
});

await runMain(main);
