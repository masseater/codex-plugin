---
name: context:should-be-project-context
description: Analyze project context files and maintain consistency. Use when updating, organizing, or auditing project context files (AGENTS.md, README.md, gotchas.md, etc.).
---

# should-be-project-context

A skill for analyzing project context files and maintaining consistency while updating and organizing them.

## Principles

- **AGENTS.md is the SSOT (Single Source of Truth)**
- **README.md is the "entry point for humans"**: The first file seen on GitHub
- **AGENTS.md is the "guide for AI agents"**: Detailed information needed for development work
- **Unified format**: Consistent structure following templates
- **Write in English**: All context files (AGENTS.md, README.md, gotchas.md, rules) must be written in English

## File Roles

### README.md

**Target audience**: Humans (GitHub visitors, new contributors)

**Placement rule**:

- **Root directory**: Required
- **Monorepo packages**: Each publishable package should have its own README.md (displayed on npm)
- **Other subdirectories**: Not needed (use AGENTS.md instead)

**What to include**:

- Project name + one-line description
- Overview (2-3 sentences, project purpose)
- Installation steps (minimal)
- Command list (all slash commands, only commonly used npm scripts)
- Related repositories/links (if any)
- License

**What NOT to include**:

- Detailed directory structure → Refer to AGENTS.md
- Architecture details → Refer to AGENTS.md
- Environment variable details → Refer to AGENTS.md or .env.example
- API specifications → Refer to AGENTS.md
- Development notes → Refer to AGENTS.md

### AGENTS.md (Root)

**Target audience**: AI agents (Claude Code, etc.), developers

**What to include**:

- Project overview (2-3 sentences)
- Directory/package structure (one-line descriptions only)
- Basic command list (commonly used ones)
- Important instructions/constraints
- Skills list
- Command last updated date

**What NOT to include**:

- Detailed usage of each package → Refer to subdirectory AGENTS.md
- Environment variable details → Refer to subdirectory AGENTS.md
- Specific code examples → Refer to subdirectory AGENTS.md
- API specifications → Refer to subdirectory AGENTS.md
- Installation steps (documented in README.md)
- License information (documented in README.md)
- References to rules (.claude/rules/ is auto-loaded, no need to reference)

### AGENTS.md (Subdirectory)

**Target audience**: AI agents (Claude Code, etc.), developers

**What to include**:

- Package/project-specific detailed information
- Development commands (all)
- Environment variables list and descriptions
- Specific command examples
- Detailed directory structure
- API specifications/exports list
- Important notes and considerations
- Command last updated date

**What NOT to include**:

- Duplicate information already in root

### CLAUDE.md

**Role**: Symbolic link to AGENTS.md

**Setup**: `ln -sf AGENTS.md CLAUDE.md` (same directory)

CLAUDE.md is NOT a separate file — it MUST be a symlink pointing to AGENTS.md. If a CLAUDE.md exists as a regular file, replace it with a symlink.

## Execution Rules

### No User Confirmation

**NEVER ask the user for confirmation.** Once this skill is invoked, make all decisions autonomously and execute to completion.
Questions like "Is this okay?" or "Should I proceed?" are strictly prohibited. When in doubt, use AGENTS.md as SSOT and act immediately.

### Subagent-Driven Execution

Launch a subagent for each target file and **process them in parallel**.
Each subagent independently reads, analyzes, and updates its assigned file.

### Task Management

Create a TODO for each target file path before launching subagents. Mark each as completed when done.

```
Example:
- [ ] Update .claude/rules/ai-generated/gotchas.md
- [ ] Update AGENTS.md
- [ ] Update README.md
```

## Processing Targets

1. **gotchas.md** - Classify and organize insights learned during sessions
2. **AGENTS.md** - Refactor project structure and architecture information
3. **README.md** - Consistency check + update command list

## Consistency Check

- Verify project overview matches AGENTS.md
- If inconsistencies exist, auto-correct README.md using AGENTS.md as SSOT

## Reference Files

- @./classification-criteria.md - Classification criteria (colocation principle, hierarchy design)
- @./readme-template.md - Unified format for README.md
- @./agents-template.md - Unified format for AGENTS.md
