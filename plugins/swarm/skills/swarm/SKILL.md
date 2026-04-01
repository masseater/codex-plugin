---
name: swarm
description: Interactively design optimal Agent Teams composition for a task.
argument-hint: "[task description]"
disable-model-invocation: true
---

> **REQUIRED**: Use **Agent Teams** for this skill. Do NOT use SubAgent (Agent tool).
> Agent Teams is experimental — it requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` enabled in settings.

This skill guides the design and launch of an Agent Team for the user's task.
Follow these steps in order, confirming with the user before proceeding to the next.

## Step 1: Understand the task

Analyze $ARGUMENTS and confirm:

- Task nature (implementation, research, review, refactoring, documentation, etc.)
- Final deliverable
- Which parts can be parallelized independently

Ask the user if anything is unclear. A clear picture of the whole task is essential before designing the team.

## Step 2: Shape the task for Agent Teams

The user has chosen Agent Teams — do NOT suggest SubAgent or single session as alternatives.
Instead, shape the task to play to Agent Teams' strengths:

- **Maximize parallelism** — identify which parts can run independently and simultaneously
- **Minimize file conflicts** — ensure each teammate owns a distinct set of files
- **Design for cross-pollination** — structure work so teammates challenge and build on each other's findings

If the task has sequential dependencies or same-file edits, restructure the approach (e.g., split phases, assign a coordinator role) rather than abandoning Agent Teams.

## Step 3: Design roles

Design the team based on **roles (expertise/perspective)**, not deliverables.
The full design guide and role templates are in @../team-design/SKILL.md — read it before proposing roles.

Present the proposed team:

| Name   | Role   | Responsibility                      |
| ------ | ------ | ----------------------------------- |
| {name} | {role} | {what this role is responsible for} |

**Team size**: 3-5 teammates. Three focused teammates often outperform five scattered ones.

### Example: Designing a new Claude Code plugin

| Name                        | Role                 | Responsibility                                                                      |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| claude-code-domain-expert   | Domain Expert        | Claude Code plugin API, skill/hook/agent specs, conventions                         |
| plugin-ecosystem-specialist | Ecosystem Specialist | Existing plugins, similar tools, reusable patterns                                  |
| ux-strategist               | UX Strategist        | User journey, trigger design, error messages, naming                                |
| devils-advocate             | Devil's Advocate     | Challenges design decisions, finds edge cases, argues "why not just use X instead?" |

### Example: Investigating a production bug

| Name         | Role                      | Responsibility                                          |
| ------------ | ------------------------- | ------------------------------------------------------- |
| hypothesis-a | Network Hypothesis        | Investigate timeout, DNS, load balancer angles          |
| hypothesis-b | Application Hypothesis    | Investigate memory leaks, race conditions, config drift |
| hypothesis-c | Infrastructure Hypothesis | Investigate disk, CPU, container limits                 |

The key is that each teammate actively challenges the others' findings.

## Step 4: Design the task list

Create tasks with TaskCreate before launching the team.
The shared task list is how Agent Teams coordinate work.

Task design principles:

- **5-6 tasks per teammate** keeps everyone productive without excessive context switching
- Set `blockedBy` dependencies between tasks explicitly
- Tasks should be self-contained units with a clear deliverable
- Avoid tasks that require two teammates to edit the same file

## Step 5: Launch the team

Create the Agent Team by describing the task and team structure in natural language:

```
Create an agent team for [task description]. Spawn teammates:
- [name-1] focused on [role]: [specific instructions and context]
- [name-2] focused on [role]: [specific instructions and context]
- [name-3] focused on [role]: [specific instructions and context]
```

Critical: teammates do NOT inherit the lead's conversation history. Include all necessary context in each teammate's spawn prompt — file paths, architecture decisions, constraints, and conventions.

**Communication patterns:**

- **Direct message**: to one specific teammate (preferred — targeted and efficient)
- **Broadcast**: to all teammates simultaneously (use sparingly — costs scale with team size)

## Step 6: Monitor and steer

While the team works:

- Check in on teammates' progress via Shift+Down (in-process mode) or clicking panes (split mode)
- If a teammate is stuck or going in a wrong direction, message them directly with corrective guidance
- Synthesize findings as they come in — look for contradictions between teammates
- When work is done, ask each teammate to shut down, then clean up the team through the lead

For operational details on Agent Teams, see: @./references/agent-teams-guide.md
