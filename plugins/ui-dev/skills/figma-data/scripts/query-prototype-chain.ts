#!/usr/bin/env bun

import { defineCommand, runMain } from "citty";
import { toColon } from "./_lib.ts";

type Interaction = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  trigger: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
};

type FrameEntry = {
  id: string;
  name: string;
  type: string;
  screenshot?: string;
  interactions: Interaction[];
};

type GraphFile = {
  meta: Record<string, unknown>;
  frames: Record<string, FrameEntry>;
};

function formatFrame(frameId: string, data: GraphFile): string {
  const frame = data.frames[frameId];
  if (!frame) return "";

  const interactions = frame.interactions ?? [];
  const lines: string[] = [];

  lines.push(`# ${frame.name} (\`${frame.id}\`, ${frame.type})`);
  lines.push("");
  if (frame.screenshot) {
    lines.push(`- **Screenshot**: \`${frame.screenshot}\``);
    lines.push("");
  }

  if (interactions.length > 0) {
    lines.push("## Interactions");
    lines.push("");
    for (const ix of interactions) {
      const isFrameLevel = ix.nodeId === frameId;
      const source = isFrameLevel ? "(self)" : `${ix.nodeName} (\`${ix.nodeId}\`, ${ix.nodeType})`;
      lines.push(`### ${source}`);
      lines.push("");
      lines.push(`- trigger: \`${JSON.stringify(ix.trigger)}\``);
      for (const [i, action] of ix.actions.entries()) {
        lines.push(`- actions[${i}]: \`${JSON.stringify(action)}\``);
      }
      lines.push("");
    }
  } else {
    lines.push("(no interactions or transitions)");
    lines.push("");
  }

  return lines.join("\n");
}

function formatPageMap(data: GraphFile): string {
  const lines: string[] = [];
  lines.push("# Page Map");
  lines.push("");
  lines.push(`**${data.meta.totalFrames} frames**`);
  lines.push("");

  for (const [id, frame] of Object.entries(data.frames)) {
    const interactions = frame.interactions ?? [];
    const iCount = interactions.length;

    lines.push(`## ${frame.name} (\`${id}\`)`);
    lines.push("");
    let summary = `interactions: ${iCount}`;
    if (frame.screenshot) summary += ` | screenshot: \`${frame.screenshot}\``;
    lines.push(summary);

    if (iCount > 0) {
      for (const ix of interactions) {
        const triggerType = (ix.trigger.type as string) ?? "?";
        const source = ix.nodeId === id ? "" : ` [${ix.nodeName}]`;
        for (const action of ix.actions) {
          if (!action) continue;
          const nav = (action.navigation as string) ?? "";
          const dest = action.destinationId as string | null | undefined;
          const destLabel = dest
            ? `-> **${data.frames[toColon(dest)]?.name ?? "?"}** (\`${dest}\`)`
            : "(self)";
          lines.push(`  ${triggerType} ${nav} ${destLabel}${source}`);
        }
      }
    }

    lines.push("");
  }

  return lines.join("\n");
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

    const data = (await file.json()) as GraphFile;

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

runMain(main);
