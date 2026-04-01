---
name: figma-screenshot
description: 'This skill should be used when the user asks to "save a Figma screenshot", "export a Figma node as image", "capture Figma design", or needs to save Figma node screenshots to local files. Prefer this over Figma MCP''s get_screenshot.'
---

# Figma Screenshot Export

Export screenshots of specified Figma nodes and save them as local files.
Uses Figma REST API as the primary method, with Desktop MCP as a fallback.

## Prerequisites

### REST API (recommended)

- Set `FIGMA_ACCESS_TOKEN` environment variable with a [Figma personal access token](https://www.figma.com/developers/api#access-tokens)
- Supports `--scale` and `--format` options

### Desktop MCP (fallback)

Used automatically when `FIGMA_ACCESS_TOKEN` is not set, or when the REST API fails.

- Figma Desktop app must be running
- Dev Mode MCP Server must be enabled in Figma settings

## Scripts

Located at `./scripts`. All scripts are standalone executable TypeScript files with a shebang. Do NOT run them via `bun` — execute them directly.

| Script                 | Description                         |
| ---------------------- | ----------------------------------- |
| `export-screenshot.ts` | Export a Figma node as a screenshot |

### export-screenshot.ts

| Option       | Required | Description                                                    |
| ------------ | -------- | -------------------------------------------------------------- |
| `--file-key` | Yes      | Figma file key (from URL)                                      |
| `--node-id`  | Yes      | Target node ID (e.g., `7247-25294` or `7247:25294`)            |
| `--output`   | Yes      | Output file path                                               |
| `--scale`    |          | Export scale 0.01-4 (REST API only, default: 1)                |
| `--format`   |          | Image format: png, jpg, svg, pdf (REST API only, default: png) |

### Usage

```bash
./scripts/export-screenshot.ts \
  --file-key abc123 \
  --node-id "7247-25294" \
  --output ./screenshot.png \
  --scale 2 \
  --format png
```

### Output

```json
{
  "success": true,
  "outputPath": "./screenshot.png",
  "nodeId": "7247-25294",
  "method": "rest-api"
}
```

- `method`: which export method was used (`"rest-api"` or `"desktop-mcp"`)
- `fallback`: `true` when REST API failed and Desktop MCP was used as fallback

## How to Get File Key and Node ID

- **File key**: Extract from Figma URL `https://www.figma.com/design/<file_key>/...`
- **Node ID**: Extract from URL query parameter `?node-id=<node_id>`
