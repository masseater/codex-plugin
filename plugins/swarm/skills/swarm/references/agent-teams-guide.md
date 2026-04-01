# Agent Teams Operational Guide

Reference material for working with Agent Teams in Claude Code.

## Prerequisites

Agent Teams is experimental. Enable it:

```json
// settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Requires Claude Code v2.1.32 or later.

## Architecture

| Component     | Role                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Team lead** | The main Claude Code session that creates the team, spawns teammates, and coordinates work |
| **Teammates** | Separate Claude Code instances that each work on assigned tasks                            |
| **Task list** | Shared list of work items that teammates claim and complete                                |
| **Mailbox**   | Messaging system for communication between agents                                          |

Teams and tasks are stored locally:

- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/`

## Creating a Team

Tell Claude to create a team in natural language. Include the task description and team structure:

```
Create an agent team to [task]. Spawn teammates:
- One focused on [role A]
- One focused on [role B]
- One focused on [role C]
```

## Teammate Context

Teammates load project context automatically (CLAUDE.md, MCP servers, skills), but do NOT inherit the lead's conversation history. Include all task-specific details in the spawn prompt.

## Communication

- **Direct message**: send to one specific teammate (preferred)
- **Broadcast**: send to all teammates simultaneously (use sparingly — costs scale with team size)

Teammates can message each other directly, not just report back to the lead. This is the key advantage over SubAgents.

## Task Coordination

The shared task list coordinates work. Tasks have three states: pending, in progress, completed. Tasks can depend on other tasks — a pending task with unresolved dependencies cannot be claimed.

- The lead can assign tasks explicitly
- Teammates can self-claim the next unassigned, unblocked task
- Task claiming uses file locking to prevent race conditions

## Team Size Guidance

- **3-5 teammates** for most workflows
- **5-6 tasks per teammate** keeps everyone productive
- Token costs scale linearly with team size
- More than 5 teammates usually hits diminishing returns

## Display Modes

| Mode                     | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| **in-process** (default) | All teammates in main terminal. Shift+Down to cycle. |
| **split panes**          | Each teammate in its own tmux/iTerm2 pane.           |

## Shutdown and Cleanup

1. Ask each teammate to shut down (they can approve or reject)
2. Once all teammates are stopped, ask the lead to clean up
3. Always clean up through the lead, not through teammates

## Limitations

- No session resumption with in-process teammates after `/resume`
- Task status can lag (teammates sometimes fail to mark tasks completed)
- One team per session
- No nested teams (teammates cannot spawn their own teams)
- Lead is fixed for the team's lifetime
- Permissions set at spawn (all teammates start with lead's permission mode)
- Two teammates editing the same file leads to overwrites

## Key Difference from SubAgents

| Aspect        | Agent Teams                                | SubAgent                                    |
| ------------- | ------------------------------------------ | ------------------------------------------- |
| Context       | Own full context window, independent       | Own context, results return to caller       |
| Communication | Teammates message each other directly      | Report results back to main agent only      |
| Coordination  | Shared task list with self-coordination    | Main agent manages all work                 |
| Best for      | Complex work requiring discussion          | Focused tasks where only the result matters |
| Token cost    | Higher (each teammate = separate instance) | Lower (results summarized back)             |
