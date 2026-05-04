# ui-dev Plugin Development Guide

Figma x AI UI implementation workflow plugin.

## Overview

A workflow plugin that structures the entire process from design to implementation, review, and verification.
Uses figma-data for design data extraction and figma-implement for the implementation workflow.

## Required Plugins

- **Anthropic official Figma plugin** — `figma:implement-design` and other skills + Figma MCP tools
- **Vercel agent-browser plugin** — Browser automation and screenshot capture

## Development Commands

```bash
cd plugins/ui-dev

bun run check        # lint + format check
bun run check:fix    # auto-fix
bun run typecheck    # type check
```

## Workflow Artifact Location

Config, screen map, etc. are placed under `.agents/ui-dev/{flow-name}/`.

## config.json Structure

```json
{
  "flow": {
    "name": "registration",
    "currentPhase": "implement",
    "figma": {
      "fileKey": "ABC123",
      "prototypeChainPath": ".agents/ui-dev/registration/prototype-chain.json"
    },
    "screens": ["signup", "email-verify", "profile-setup"]
  },
  "contextFiles": [".agents/ui-dev/design-rules.md"],
  "reviewPrompts": {
    "common": ["Common review instructions"],
    "visual": ["visual-reviewer specific instructions"],
    "code": ["code-reviewer specific instructions"]
  }
}
```

## Hooks Implementation

Implemented as TypeScript files in the hooks/ directory using cc-hooks-ts.

- `redirect-figma-screenshot` is registered globally in `hooks/hooks.json` (PreToolUse, matcher `mcp__.*figma.*__get_screenshot`).
- `notify-phase-status` is wired through skill frontmatter `hooks:` and fires only while the skill is active.

## File Reference Rules

- In hooks.json: `./hooks/xxx.ts`
- In skills: `@./skills/xxx/reference.md`

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                      | Description                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | dev-command               | This skill should be used when the user asks to "generate design feedback", "create QA checklist", "scaffold screen map", "update screen map", "run ui-dev check", or needs manual utility commands for UI implementation workflows.                                                                                                                                 |
| skill | figma-data                | This skill should be used when the user asks to "extract Figma design data", "get CSS properties from Figma", "trace prototype chain", "export assets from Figma", "get component variants", or needs exact design values (colors, spacing, typography, interactions) from Figma nodes via API.                                                                      |
| skill | figma-implement           | This skill should be used when the user asks to "implement Figma screens", "implement this design", "implement the whole flow", "batch implement from Figma", "implement all screens", or provides a Figma prototype URL and wants to build the UI. Traces the prototype graph, plans all screens, then implements one screen at a time with subagent-driven review. |
| skill | figma-screenshot          | This skill should be used when the user asks to "save a Figma screenshot", "export a Figma node as image", "capture Figma design", or needs to save Figma node screenshots to local files. Prefer this over Figma MCP's get_screenshot.                                                                                                                              |
| agent | code-reviewer             | Compare UI implementation code against the screen map and list discrepancies as facts. Does not make judgments. Use when reviewing code quality of UI implementation.                                                                                                                                                                                                |
| agent | figma-implementer         | Implement UI screens from Figma designs and record results in report files. Has two modes: initial implementation and fix. Use when implementing or fixing a UI screen from Figma design.                                                                                                                                                                            |
| agent | visual-reviewer           | Compare Figma design with implementation screenshots and list visual diffs as facts. Does not make judgments. Use when reviewing visual fidelity of UI implementation.                                                                                                                                                                                               |
| hook  | redirect-figma-screenshot | PreToolUse (`mcp__.*figma.*__get_screenshot`)                                                                                                                                                                                                                                                                                                                        |

<!-- END:component-list -->
