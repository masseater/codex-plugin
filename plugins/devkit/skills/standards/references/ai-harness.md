---
description: AI harness engineering — Hook feedback loops, error message design for agents, and AGENTS.md design principles
---

# AI Harness Engineering

Principles for designing environments where AI Coding Agents reliably produce correct code. Enforce quality through systems (Hooks, linters, tests), not prompt instructions.

## Feedback Loop — 4 Layers

Embed quality constraints into the agent's execution cycle via Hooks. Each layer functions independently; combining them creates defense in depth.

### PreToolUse — Safety Gate

Block dangerous operations before execution. Prevent direct `.env` edits, destructive commands, and other actions that are too late to undo once executed.

### PostToolUse — Immediate Feedback

Automatically run linters and formatters after file edits and inject results into the agent's context via `additionalContext`. The agent receives structured feedback and self-corrects autonomously. Writing to stdout alone is insufficient — return structured JSON with `hookSpecificOutput.additionalContext` so the agent reliably recognizes the feedback.

### Stop — Completion Verification

Run tests and type checks before the agent declares completion. Do not allow completion until they pass. This structurally prevents the state of "work is done but tests are failing."

#### Quality-Check Log Pattern

Stop hooks that run quality checks (lint, typecheck, test, etc.) must write per-job log files so the agent can pinpoint exactly what failed.

- Log directory: `.claude/hooks/quality-check-log/`
- Log file: `[jobname].log` — one file per failed job only. Passing jobs produce no log file
- Clean the log directory on every run (remove stale logs from previous runs)
- Each log line contains the file path and a concise failure description
- The `reason` returned to the agent is a summary listing which jobs failed and their log paths — not the full output. The agent reads the individual log files to get details

Why per-job log files instead of a single report:

- The agent can read only the relevant log for the job it is fixing — no need to parse a monolithic report
- Log files persist across agent correction loops, making it easy to diff before/after
- Each job's output stays small and focused, matching the "error messages as fix instructions" principle

### Observability

Log events across all layers — execution intent, results, and duration. Visualize how often each Hook fires and how many correction loops the agent runs to identify harness improvement opportunities. See `references/observability.md` for details.

## Error Messages as Fix Instructions

Design linter and custom check error messages as fix instructions for AI agents. Pointing out the violation alone is insufficient — include why the rule exists (WHY) and how to fix it (FIX).

Elements an error message should contain:

| Element                      | Purpose                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| What is wrong                | Identify the violation                                                                             |
| File and line number         | Locate the fix target                                                                              |
| WHY — reason the rule exists | Reference to ADR or documentation. Helps the agent understand "why" and prevent similar violations |
| FIX — repair steps           | Natural language description of the fix, detailed enough for the agent to execute directly         |

This design lets tools "educate" the agent as they run. No human intervention needed each time an error occurs.

When writing custom lint rules (oxlint JS plugins or ESLint custom plugins), design error messages with the assumption that an AI agent will read them. Prefer `--fix` for auto-remediable issues; for those that cannot be auto-fixed, include sufficient information in FIX.

## AGENTS.md / CLAUDE.md Design Principles

Design principles for context files read by AI agents.

### Size Constraint

Target 50 lines or fewer. Research confirms that model performance degrades noticeably beyond 150 lines. The longer the context, the more stale or irrelevant information becomes noise that degrades agent judgment.

### Pointer-Based Design

Do not write details in AGENTS.md itself — place pointers (path references) to other files.

What to write:

- Routing instructions ("for this kind of work, see X" pointers)
- Prohibited actions list (each item referencing an ADR or lint rule)
- Minimal build, test, and deploy commands

What not to write:

- System state descriptions (code and tests are the source of truth)
- Tech stack explanations (discoverable from package.json or go.mod)
- Coding style guides (delegate to linters)

### Staleness Detection

A benefit of pointer-based design: when a referenced file path no longer exists, the agent encounters an error when trying to read it, making staleness mechanically detectable. Prose descriptions rot silently; path references break loudly.
