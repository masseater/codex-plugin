---
name: figma-data
description: 'This skill should be used when the user asks to "extract Figma design data", "get CSS properties from Figma", "trace prototype chain", "export assets from Figma", "get component variants", or needs exact design values (colors, spacing, typography, interactions) from Figma nodes via API.'
---

# figma-data

Extract precise design data from the Figma REST API — prototype graph traversal (BFS), interactions, exact CSS values, component APIs, and asset export.

## Figma MCP vs API Scripts

Use MCP tools for quick overview and visual confirmation. Use API scripts when exact values matter.

| Need                                                | Use                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| Visual reference, approximate code                  | `get_design_context` (MCP)                                                       |
| Screenshot                                          | Do NOT use `get_screenshot` — use `figma-screenshot` skill or API export instead |
| Layer structure overview                            | `get_metadata` (MCP)                                                             |
| Design tokens / variables                           | `get_variable_defs` (MCP)                                                        |
| Exact CSS values (colors, spacing, radius, shadows) | `extract-node-properties.ts` (API)                                               |
| Prototype interactions, transitions, easing         | `trace-prototype-chain.ts` + `query-prototype-chain.ts` (API)                    |
| SVG/PNG asset export                                | `export-node-images.ts` (API)                                                    |
| Component variant props and combinations            | `get-component-variants.ts` (API)                                                |
| All pages/frames in a file                          | `list-file-frames.ts` (API)                                                      |

## Recommended Workflow

1. **Overview**: `get_design_context` (MCP) for reference code + screenshot
2. **Structure**: `list-file-frames.ts` to discover all pages/frames
3. **Exact values**: `extract-node-properties.ts` for the node being implemented
4. **Components**: `get-component-variants.ts` if implementing a component with variants
5. **Assets**: `export-node-images.ts` for icons/illustrations as SVG
6. **Interactions**: `trace-prototype-chain.ts` + `query-prototype-chain.ts` for transitions

## Core Principle: Query Only What Is Being Implemented Right Now

Query data on-demand per node. Never bulk-fetch all nodes upfront — each query loads data into context, and unused data wastes tokens.

## Inputs

| Parameter | Required | Description                             |
| --------- | -------- | --------------------------------------- |
| `fileKey` | Yes      | Figma file key (from URL path)          |
| `nodeId`  | Yes      | Node ID (colon or dash format accepted) |

Extract from a Figma URL like `https://www.figma.com/design/<fileKey>/...?node-id=<nodeId>`.

## Mode Selection

Choose **one** mode per invocation. Never run Mode B as a prerequisite for Mode A.

| Situation                                  | Mode           |
| ------------------------------------------ | -------------- |
| List all pages/frames in a file            | C              |
| Figma URL with page/frame node (default)   | A              |
| Landing page with scroll animations        | A              |
| Multi-step onboarding flow                 | A              |
| Prototype already traced (reuse JSON)      | A (query only) |
| Single button or icon interaction          | B              |
| Verify if a specific node has interactions | B              |

## Mode A: Prototype Graph Trace (default)

### Step 1 — Trace (once per Figma URL)

```bash
./scripts/trace-prototype-chain.ts \
  --file-key <fileKey> --node-id <nodeId> --output <outputPath>
```

BFS-traverses the entire prototype graph from the starting node. Discovers all connected frames by scanning `interactions[].actions[].destinationId` on any node including children (buttons, instances, etc.).

Saves PNG screenshots of all frames to `<output-dir>/screenshots/` and records file paths in the JSON.

After the trace completes, confirm frame counts and JSON path. **Stop here.** Return to implementation and only proceed to Step 2 when a specific node's interaction data is needed.

### Step 2 — Query (on-demand, per-node or full page map)

When actively writing code for a specific node and interaction details are needed:

```bash
./scripts/query-prototype-chain.ts \
  --json-path <path> --node-id <nodeId>
```

To view the full page map with all frame connections:

```bash
./scripts/query-prototype-chain.ts \
  --json-path <path> --node-id map
```

Both colon (`18067:11823`) and dash (`18067-11823`) formats are accepted.

Relay the markdown output directly. Never parse the graph JSON manually.

## Mode B: Single Node Inspection

For quick checks on a single isolated node:

```bash
./scripts/fetch-figma-node-response.ts \
  --file-key <fileKey> --node-id <nodeId>
```

Confirm whether the target node resolved to a real `document` or `null`.

## Mode C: List All Pages and Frames

List every page and top-level frame in a Figma file. Use this to discover all node IDs before tracing a specific chain.

```bash
./scripts/list-file-frames.ts \
  --file-key <fileKey> [--output <outputPath>]
```

Without `--output`, prints JSON to stdout. With `--output`, writes JSON to file and prints summary to stdout.

## Scripts

All scripts are standalone executable TypeScript files with a shebang. Do NOT run them via `bun` — execute them directly (e.g., `./scripts/trace-prototype-chain.ts --help`).

| Script                                                                         | Purpose                         | Input                                                     | Output                 |
| ------------------------------------------------------------------------------ | ------------------------------- | --------------------------------------------------------- | ---------------------- |
| `./scripts/list-file-frames.ts`          | List all pages/frames           | `--file-key [--output]`                                   | JSON to stdout or file |
| `./scripts/extract-node-properties.ts`   | Exact CSS-equivalent properties | `--file-key --node-id [--depth] [--output]`               | JSON to stdout or file |
| `./scripts/get-component-variants.ts`    | Component variant analysis      | `--file-key --node-id [--output]`                         | JSON to stdout or file |
| `./scripts/export-node-images.ts`        | Export SVG/PNG assets           | `--file-key --node-ids --output-dir [--format] [--scale]` | Files to directory     |
| `./scripts/trace-prototype-chain.ts`     | BFS prototype graph trace       | `--file-key --node-id --output`                           | JSON file              |
| `./scripts/query-prototype-chain.ts`     | Query graph (per-node or `map`) | `--json-path --node-id`                                   | Markdown to stdout     |
| `./scripts/fetch-figma-node-response.ts` | Single node raw fetch           | `--file-key --node-id`                                    | JSON to stdout         |

## Error Handling

| Error                           | Cause                                                      | Resolution                                 |
| ------------------------------- | ---------------------------------------------------------- | ------------------------------------------ |
| `FIGMA_ACCESS_TOKEN is not set` | Missing env var                                            | Export the token before running            |
| `document: null` for known node | Node ID format mismatch                                    | Try both colon and dash formats            |
| Single frame (no edges)         | No `transitionNodeID` or `interactions` destinations found | Verify the correct starting frame in Figma |
| Graph stops early               | All reachable frames already visited                       | Expected — BFS stops on revisit            |
