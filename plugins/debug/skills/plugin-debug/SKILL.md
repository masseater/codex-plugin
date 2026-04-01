---
name: plugin-debug
description: "This skill should be used when the user asks about 'debug plugin behavior', 'what does the debug plugin save', 'debug plugin files', 'where does debug plugin write', or mentions debug plugin data storage and session artifacts."
---

# plugin-debug

Reference for the debug plugin's runtime behavior. Describes what data is saved, where it is stored, and how the SessionStart hooks operate.

## Plugin Purpose

The debug plugin is a lightweight diagnostic tool for Claude Code plugin development. It verifies that:

- Plugin installation and loading work correctly
- The `CLAUDE_PLUGIN_ROOT` environment variable resolves properly
- SessionStart hooks execute and produce expected output

## Data Written at Session Start

The debug plugin's SessionStart hooks execute on every session event (startup, resume, clear, compact). The following data is produced:

| Destination                                    | Content                                      | Persistence              |
| ---------------------------------------------- | -------------------------------------------- | ------------------------ |
| `$XDG_STATE_HOME/claude-code-plugin/debug.txt` | `CLAUDE_PLUGIN_ROOT` absolute path           | Overwritten each session |
| stdout (additionalContext)                     | Structured context about debug plugin status | Conversation only        |

Default `XDG_STATE_HOME` is `~/.local/state` when the environment variable is not set.

### State File

Written by the SessionStart hook at `$XDG_STATE_HOME/claude-code-plugin/debug.txt`. Contains the resolved `CLAUDE_PLUGIN_ROOT` path as a single line. Overwritten on every session start — only the most recent value is retained.

Use this file to verify that `CLAUDE_PLUGIN_ROOT` resolves correctly outside of the Claude Code session (e.g., from a separate terminal).

### Session Context

The SessionStart hook outputs a structured context message via `additionalContext`, which Claude Code injects as a `<system-reminder>`. This informs the AI that the debug plugin is active and provides key environment details. No command output is shown — only the context message is passed.

## Environment Variables

| Variable             | Description                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| `CLAUDE_PLUGIN_ROOT` | Absolute path to the debug plugin directory. Set by Claude Code for all plugin hooks. |
| `XDG_STATE_HOME`     | Base directory for state data. Falls back to `~/.local/state`.                        |

## Diagnostic Workflow

When troubleshooting plugin issues:

1. Check the system-reminder output at session start — confirm "Debug plugin active" appears
2. Read `$XDG_STATE_HOME/claude-code-plugin/debug.txt` to verify `CLAUDE_PLUGIN_ROOT` resolution
3. Compare the path in the file with the expected plugin installation directory
4. If the file is missing or empty, the SessionStart hook failed to execute — check hook registration in `hooks/hooks.json`
