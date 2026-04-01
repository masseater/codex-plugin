---
name: task-history
description: "Review past task and TODO history from previous sessions. Use when asked to review past work, check what was done, or reflect on completed tasks."
allowed-tools: Bash(./query.ts *), Read
---

# Task History: Review Past Work

Display task and TODO history persisted by the `task-history` PostToolUse hook.

`$ARGUMENTS`

## Usage

Run the query tool to retrieve history:

```bash
./query.ts [options]
```

### Options

| Flag              | Description                                        | Default |
| ----------------- | -------------------------------------------------- | ------- |
| `--recent N`      | Show last N events                                 | 50      |
| `--session ID`    | Filter by session ID                               | (all)   |
| `--status STATUS` | Filter by status (pending, in_progress, completed) | (all)   |
| `--since DATE`    | Show events since ISO date                         | (all)   |

### Examples

```bash
# Recent 50 events (default)
./query.ts

# Only completed tasks
./query.ts --status completed

# Events from today
./query.ts --since 2026-03-24
```

## How to Present Results

- Group events by session
- Show timestamp, event type, subject, and status for each event
- Highlight completed tasks
- If the user asks to "reflect" or "振り返り", summarize what was accomplished across sessions
