---
name: persona:switch
disable-model-invocation: true
description: "Manual persona state command replacement for direct skill invocation only. Switches planner / worker state, clears it, or displays current persona status."
argument-hint: "planner|worker|clear|status"
tools:
  - Bash(${CLAUDE_SKILL_DIR}/scripts/persona-state.ts *)
---

# Persona Switch

Manual replacement for the removed persona slash commands.

## Workflow

1. Determine the requested action from the skill argument.
2. Run `${CLAUDE_SKILL_DIR}/scripts/persona-state.ts <action>`.
3. Report the resulting persona state concisely.

Supported actions:

- `planner`: switch this Claude Code session to planner persona
- `worker`: switch this Claude Code session to worker persona
- `clear`: clear the session persona
- `status`: print the current session persona

If no action is provided, run `status`.

## Notes

The script requires `CLAUDE_PROJECT_DIR` and `CLAUDE_CODE_SESSION_ID`, matching the persona hooks. It writes session state to `$CLAUDE_PROJECT_DIR/.agents/tmp/persona/<session_id>`.
