---
name: mutils:ccs-handoff
description: Use when a CCS profile hits rate limits, usage caps, or context overflow. Reads session data from another profile and resumes interrupted work.
tools:
  - Bash(./ccs-handoff.ts *)
  - Read
  - Glob
  - Grep
  - TodoWrite
---

# CCS Session Handoff

Resume interrupted work from another CCS profile session. Use when a profile hits rate limits, usage caps, or context overflow.

## Execution Steps

### 1. Parse Arguments

Parse `$ARGUMENTS` by splitting on whitespace: the first token is `<profile>` and the second token is `<sessionId>`.

- If arguments are missing, ask the user for the profile name and session ID.

### 2. Run Handoff Script

```bash
./ccs-handoff.ts <profile> <sessionId>
```

Read the Markdown output from the script carefully.

### 3. Restore Working Context

From the script output, perform the following:

1. **Change directory**: `cd` to the Project Path shown in Session Info
2. **Check Git Branch**: Compare the branch in Session Info with the current branch. **DO NOT checkout or switch branches** (prohibited by AGENTS.md). If branches differ, report the discrepancy to the user.
3. **Re-register pending items**: From the "Pending Tasks" and "Pending TODOs" sections, re-register all items into the current session using TodoWrite.
4. **Understand interrupted work**: Read and internalize the Session Summary, First Prompt, and Recent Messages sections to understand what was being worked on.
5. **Gather additional context**: Check the following for supplementary information:
   - `git status` — current working tree state
   - `.agents/sessions/` — any session reports from the previous work
   - `.agents/plans/` — any active plan files
6. **Subagent awareness**: If the Subagents section indicates detection, inform the user that the previous session had active subagent sessions.

### 4. Report and Continue

Report a concise handoff summary to the user, including:

- What work was in progress
- Current TODO/Task status
- Any branch or context discrepancies
- Recommended next steps

Then continue the interrupted work.
