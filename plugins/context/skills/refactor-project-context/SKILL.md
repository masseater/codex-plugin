---
name: refactor-project-context
description: Use when scanning and reorganizing all project context files (AGENTS.md, README.md, gotchas.md, .claude/rules/) for consistency, accuracy, and structural alignment.
allowed-tools: Read, Write(.claude/**), Write(AGENTS.md), Write(README.md), Write(**/AGENTS.md), Write(**/README.md), Bash(ls), Bash(mkdir), Glob, Grep, TodoWrite, AskUserQuestion, Skill(context:should-be-project-context), Skill(research:semtools), Skill(context:refactor-context-file), Skill(context:verify-context)
---

Organize and synchronize all context files across the project.

## Execution Steps

### 0. Load Skill

Load the `should-be-project-context` Skill to understand the templates and processing rules.

### 1. Detect Project Structure

Infer the project structure from:

- `workspaces` field in `package.json`
- `pnpm-workspace.yaml`
- Directory layout

Present the detected structure via AskUserQuestion:

```
Detected project structure:
- Root: /path/to/project
- Sub-packages:
  - packages/xxx
  - packages/yyy

Proceed with this structure?
```

### 2. Scan Target Files

Search for the following files/directories:

- `**/AGENTS.md`
- `**/README.md`
- `.claude/rules/*.md`
- `**/CLAUDE.md`: Enforce that these contain only `@AGENTS.md`. Migrate any other content to AGENTS.md

List all found files and confirm processing order via AskUserQuestion.

### 3. Verify and Rename CLAUDE.md

Check all CLAUDE.md files. If any contain content beyond the AGENTS.md reference, rename them to AGENTS.md.
If AGENTS.md already exists in the same directory, merge using AGENTS.md as the base.

### 4a. Generate CLAUDE.md

Detect directories where AGENTS.md exists but CLAUDE.md does not, then create CLAUDE.md with:

`echo "@AGENTS.md" >> "CLAUDE.md"`

This ensures AGENTS.md serves as the SSOT, with CLAUDE.md acting as a reference-only alias.

### 4b. Process README.md

For each README.md, follow the `should-be-project-context` Skill criteria:

1. Extract content that belongs in AGENTS.md
2. Update the command list (all slash commands; npm scripts with user confirmation)
3. Unify formatting per template; update context files as needed

### 5. Process Context Files

For each context file (AGENTS.md, `.claude/rules/*.md`):

1. Run `/context:verify-context <file-path>` to verify technical accuracy
2. Run `/context:refactor-context-file <file-path>` for detailed decomposition and refactoring

Running verification first prevents propagating incorrect information during refactoring.

### 6. Per-File Confirmation Flow

For each file:

1. Analyze current content
2. Display change proposals
3. Confirm with user (approve / modify / skip)
4. Apply approved changes

### 7. Completion Report

- List of created/updated files
- Deleted/archived content
- Content remaining in gotchas.md (with reasons if applicable)
- Recommended next actions
