#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import * as v from "valibot";
import { stringField } from "./_json.ts";
import { toColon } from "./_lib.ts";

const JsonRecordSchema = v.record(v.string(), v.unknown());

const InteractionSchema = v.object({
  nodeId: v.string(),
  nodeName: v.string(),
  nodeType: v.string(),
  trigger: JsonRecordSchema,
  actions: v.array(JsonRecordSchema),
});

const FrameEntrySchema = v.object({
  id: v.string(),
  name: v.string(),
  type: v.string(),
  screenshot: v.optional(v.string()),
  interactions: v.array(InteractionSchema),
});

/** trace-prototype-chain.ts が書き出すグラフ JSON の形 */
const GraphFileSchema = v.object({
  meta: v.looseObject({ totalFrames: v.number() }),
  frames: v.record(v.string(), FrameEntrySchema),
});

type GraphFile = v.InferOutput<typeof GraphFileSchema>;

type FrameEntry = GraphFile["frames"][string];
type Interaction = FrameEntry["interactions"][number];

function interactionSource(ix: Interaction, frameId: string): string {
  return ix.nodeId === frameId ? "(self)" : `${ix.nodeName} (\`${ix.nodeId}\`, ${ix.nodeType})`;
}

function interactionLines(ix: Interaction, frameId: string): string[] {
  return [
    `### ${interactionSource(ix, frameId)}`,
    "",
    `- trigger: \`${JSON.stringify(ix.trigger)}\``,
    ...ix.actions.map((action, i) => `- actions[${i}]: \`${JSON.stringify(action)}\``),
    "",
  ];
}

function interactionsSection(frame: FrameEntry, frameId: string): string[] {
  if (frame.interactions.length === 0) return ["(no interactions or transitions)", ""];
  return [
    "## Interactions",
    "",
    ...frame.interactions.flatMap((ix) => interactionLines(ix, frameId)),
  ];
}

function formatFrame(frameId: string, data: GraphFile): string {
  const frame = data.frames[frameId];
  if (!frame) return "";
  return [
    `# ${frame.name} (\`${frame.id}\`, ${frame.type})`,
    "",
    ...(frame.screenshot ? [`- **Screenshot**: \`${frame.screenshot}\``, ""] : []),
    ...interactionsSection(frame, frameId),
  ].join("\n");
}

/**
 * 遷移先を表す表記を作る。遷移先が無ければ自身への操作とみなす。
 * @param dest 遷移先のノード ID
 * @param data グラフ
 * @returns 遷移先の表記
 */
function destinationLabel(dest: string | undefined, data: GraphFile): string {
  if (!dest) return "(self)";
  return `-> **${data.frames[toColon(dest)]?.name ?? "?"}** (\`${dest}\`)`;
}

function actionLine(
  ix: Interaction,
  action: Record<string, unknown>,
  frameId: string,
  data: GraphFile,
): string {
  const triggerType = stringField(ix.trigger, "type") ?? "?";
  const nav = stringField(action, "navigation") ?? "";
  const source = ix.nodeId === frameId ? "" : ` [${ix.nodeName}]`;
  return `  ${triggerType} ${nav} ${destinationLabel(stringField(action, "destinationId"), data)}${source}`;
}

function frameSummary(frame: FrameEntry): string {
  const screenshot = frame.screenshot ? ` | screenshot: \`${frame.screenshot}\`` : "";
  return `interactions: ${frame.interactions.length}${screenshot}`;
}

function pageMapEntry(id: string, frame: FrameEntry, data: GraphFile): string[] {
  return [
    `## ${frame.name} (\`${id}\`)`,
    "",
    frameSummary(frame),
    ...frame.interactions.flatMap((ix) =>
      ix.actions.map((action) => actionLine(ix, action, id, data)),
    ),
    "",
  ];
}

function formatPageMap(data: GraphFile): string {
  return [
    "# Page Map",
    "",
    `**${data.meta.totalFrames} frames**`,
    "",
    ...Object.entries(data.frames).flatMap(([id, frame]) => pageMapEntry(id, frame, data)),
  ].join("\n");
}

const main = defineCommand({
  meta: {
    name: "query-prototype-chain",
    description: "Query a prototype graph JSON: show a specific frame's data or the full page map",
  },
  args: {
    "json-path": {
      type: "string",
      description: "Path to the prototype graph JSON file",
      required: true,
    },
    "node-id": {
      type: "string",
      description: "Node ID to query (colon or dash format). Use 'map' to show the full page map.",
      required: true,
    },
  },
  async run({ args }) {
    const jsonPath = args["json-path"];
    const nodeId = args["node-id"];

    const file = Bun.file(jsonPath);
    if (!(await file.exists())) {
      throw new Error(`File not found: ${jsonPath}`);
    }

    const data = v.parse(GraphFileSchema, await file.json());

    if (nodeId === "map") {
      console.log(formatPageMap(data));
      return;
    }

    const nid = toColon(nodeId);
    if (data.frames[nid]) {
      console.log(formatFrame(nid, data));
      return;
    }

    console.error(`[WARN] Node ${nodeId} not found in graph.`);
    console.error(
      `Available frames: ${Object.entries(data.frames)
        .map(([id, f]) => `${id} (${f.name})`)
        .join(", ")}`,
    );
    process.exit(1);
  },
});

await runMain(main);
