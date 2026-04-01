---
name: figma-implement
description: 'This skill should be used when the user asks to "implement Figma screens", "implement this design", "implement the whole flow", "batch implement from Figma", "implement all screens", or provides a Figma prototype URL and wants to build the UI. Traces the prototype graph, plans all screens, then implements one screen at a time with subagent-driven review.'
argument-hint: "[flowName] [Figma URL]"
hooks:
  PreToolUse:
    - matcher: "mcp__.*figma.*__get_screenshot"
      hooks:
        - type: command
          command: "../../hooks/entry/redirect-figma-screenshot.ts"
  Stop:
    - hooks:
        - type: command
          command: "../../hooks/entry/notify-phase-status.ts"
---

# Figma UI Implementation

Trace prototype graph to plan all screens, then implement one screen at a time with subagent-driven implementation and review.
The parent acts as an orchestrator, delegating implementation and review to subagents.

## Prerequisites

- Figma designs are marked as Ready for Dev
- Working branch is isolated via git worktree (recommended)
- Anthropic official Figma plugin is installed

## Injections

- `!.agents/ui-dev/$ARGUMENTS/config.json` — existing config (resume if present)
- `!git worktree list` — worktree status

---

## Phase 1: Preparation (only if config.json does not exist)

If config.json already exists, skip to Phase 2 and resume. Resume position is determined by the state of the reports/ directory:

- No `{screen}-implement.md` → Start from Step 1 (implementation)
- `{screen}-implement.md` exists but no `{screen}-visual-review.md` or `{screen}-code-review.md` → Start from Step 2 (review)
- Review reports exist, `{screen}-fix-{N}.md` is the latest (no corresponding re-review) → Start from Step 2 (treat fix-N as the implement report)
- Review reports exist, no fix → Start from Step 3 (auto-classify and fix if needed)

### Step 1: URL Parsing

1. Extract flow name and Figma URL from `$ARGUMENTS` (e.g., `registration https://figma.com/design/...?node-id=xxx`)
2. Extract fileKey and nodeId from the URL
3. Create artifact directories:
   - `.agents/ui-dev/{flowName}/`
   - `.agents/ui-dev/{flowName}/screenshots/`
   - `.agents/ui-dev/{flowName}/reports/`

### Step 2: Prototype Graph Trace + Screenshots

```bash
../figma-data/scripts/trace-prototype-chain.ts \
  --file-key <fileKey> --node-id <nodeId> \
  --output .agents/ui-dev/{flowName}/prototype-chain.json
```

BFS-traverses the prototype graph and automatically saves PNG screenshots for all discovered frames to `<output-dir>/screenshots/`. Screenshot paths are recorded in the graph JSON under `frames[id].screenshot`.

Check the frame count and JSON path. If only 1 frame, confirm with the user whether the start node is correct.

Use `query-prototype-chain.ts --json-path <path> --node-id map` to view the full page map with all frame connections — useful as a reference when creating the screen map.

### Step 3: Create Screen Map (All Screens)

Create a screen map based on the prototype chain:

1. Generate `.agents/ui-dev/{flowName}/screen-map.md` from the screen map template
2. Fill in all screen information (transitions, states, validation, etc.)
3. Confirm with the user; mark unclear items with `⚠️ Unconfirmed`

Screen map template: @./references/screen-map-template.md

### Step 4: Generate config.json

```json
{
  "flow": {
    "name": "{flowName}",
    "currentPhase": "implement",
    "figma": {
      "fileKey": "{fileKey}",
      "prototypeChainPath": ".agents/ui-dev/{flowName}/prototype-chain.json"
    },
    "screens": ["{screen1}", "{screen2}", "..."]
  },
  "contextFiles": [],
  "reviewPrompts": {
    "common": [],
    "visual": [],
    "code": []
  }
}
```

Suggest customizing `reviewPrompts` and `contextFiles` (files to reference during review, e.g., design system documentation).

---

## Phase 2: Implementation Loop

### Critical Rules

- **The parent is an orchestrator ONLY.** The parent MUST NOT write any implementation code itself. ALL implementation and review work MUST be delegated to subagents via the Task tool
- **Do not ask the user for confirmation at each step.** Complete all screens autonomously and report the results at the end
- **All review findings must be addressed** — fix every issue reported by reviewers. If a finding cannot be fixed via code (spec ambiguity, design issue, architecture concern), record it as a TODO and move on
- **Interactions are mandatory.** Every screen's transitions, animations, and interactive behaviors from the prototype chain and screen map MUST be implemented. Skipping interactions is not acceptable

```
for (screen in screens) {
  1. Spawn implementation subagent (via Task tool) -> write to report
  2. Spawn review subagents in parallel (via Task tool)
  3. Auto-classify findings and spawn fix subagent (via Task tool) if needed -> return to 2
  4. When no fixable findings remain, move to next screen
}
```

### Step 1: Spawn Implementation Subagent

Spawn via the Task tool. See `@../../agents/implementer.md` for the agent definition, input/output format, and report structure.

When the subagent returns, **read the report file** to get information. Do not use the subagent's return text. If the report does not exist, restart with the same prompt once. If it fails twice in a row, report to the user.

### Step 2: Spawn Review Subagents (Parallel)

Read the implementation file list from the report and spawn two review agents **in parallel** via the Task tool.
See `@../../agents/visual-reviewer.md` and `@../../agents/code-reviewer.md` for review agent definitions.

If one review agent returns without writing a report, restart only that agent once. If both fail, report to the user.

### Step 3: Auto-Classify and Fix

Read both review reports and auto-classify findings. **Do not ask the user for judgment.** Address all findings autonomously:

#### Issue Classification Guide (A/B/C/D)

| Category                          | Description                                                | Action                                                                     |
| --------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| **A. Fixable via code**           | Bugs, style mismatches, missing implementation             | Fix -> re-run Step 2                                                       |
| **B. Spec ambiguity/gap**         | Undefined retry limits, missing timeout handling, etc.     | Make a reasonable assumption, fix, and record the assumption in the report |
| **C. Design change needed**       | Undefined error states, layout breaks with real data, etc. | `// TODO(design):` + mark screen map with `⚠️ Unconfirmed`                 |
| **D. Architecture change needed** | State management rethink, API call timing change, etc.     | Record in "Unresolved TODOs" in the report                                 |

- **A and B findings**: Spawn fix subagent to address all of them. All reviewer findings must be fixed
- **C and D findings**: Record as TODOs and proceed (these require human decisions)
- **No fixable findings (A/B)**: Screen passes. Go to Step 4

### Step 4: Spawn Fix Subagent

Spawn a new subagent in fix mode. See `@../../agents/implementer.md` for fix mode details.

If the fix subagent returns without writing a report, restart once (same as implementation subagent).

After fix completion, return to Step 2. Re-reviews overwrite the same filenames (`{screenName}-visual-review.md`, `{screenName}-code-review.md`).

If the fix loop exceeds 3 iterations for the same screen, record remaining findings as TODOs and move to the next screen.

### Step 5: Move to Next Screen

Move to the next incomplete screen and return to Step 1.

### Screen Pass Criteria

- No critical visual diffs in visual-review (or all addressed)
- No missing transitions or states in code-review (or all addressed)
- Any unresolvable items are recorded as TODOs + in the screen map

---

## Phase 3: Completion

When the implementation loop completes for all screens:

1. Update config.json `currentPhase` to `"done"`
2. Present a **comprehensive completion summary** to the user, including:
   - List of all implemented screens and their status
   - All fix iterations performed per screen
   - All remaining TODOs (categorized by C/D type)
   - Any assumptions made during B-type fixes

This is the only point where the user receives a full report. Make it thorough.

---

## Directory Structure

```
.agents/ui-dev/{flowName}/
├── config.json
├── screen-map.md
├── prototype-chain.json
├── screenshots/
│   ├── {screen1}.png
│   ├── {screen2}.png
│   └── ...
└── reports/
    ├── {screen1}-implement.md
    ├── {screen1}-visual-review.md
    ├── {screen1}-code-review.md
    ├── {screen1}-fix-1.md          (if fixes were made)
    ├── {screen2}-implement.md
    └── ...
```

---

## Troubleshooting

| Situation                                  | Resolution                                                                                         |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Prototype chain trace returns only 1 frame | Confirm with user that the start node is correct. Verify a frame node (not page node) is specified |
| Prototype chain trace fails                | Check `FIGMA_ACCESS_TOKEN` setup. Try both node-id formats (colon/dash)                            |
| Subagent returns without writing a report  | Restart with the same prompt once. If it fails twice, report to the user                           |
| get_design_context returns empty           | Verify the node-id is correct. Check that the node is Ready for Dev in Figma                       |
| Fix loop is dragging on                    | Present remaining issues summary to user and ask whether to skip or proceed                        |
