---
name: workspace-id
description: "Use when creating workspace directories for agent work. Defines the canonical workspace-id format, directory structure, and file naming convention."
tools:
  - Bash(./generate.ts *)
---

# Workspace ID Skill

This skill provides the canonical format and conventions for managing agent workspaces. Use this skill when creating new workspace directories or documenting workspace-related workflows.

## Workspace ID Format

Workspace IDs follow a strict format to ensure consistency across all agent work:

```
yyyymmdd-HHmm-[feature-name]
```

### Format Components

| Component    | Format     | Example      | Notes                                                 |
| ------------ | ---------- | ------------ | ----------------------------------------------------- |
| Date         | `yyyymmdd` | `20260302`   | Local date, 4-digit year, 2-digit month, 2-digit day  |
| Time         | `HHmm`     | `1430`       | Local time in 24-hour format (hours and minutes only) |
| Feature Name | kebab-case | `doc-engine` | Must match regex: `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`   |

### Feature Name Rules

- Must start with a lowercase letter
- Can contain lowercase letters and digits
- Hyphens separate words (kebab-case only)
- No underscores, spaces, or special characters
- Examples: `fix-parser`, `add-auth`, `refactor-utils`, `v2-migration`

## Directory Structure

All workspace files are organized under the `.agents/workspaces/` directory:

```
.agents/workspaces/
└── [workspace-id]/
    ├── [nnnnnn]-[subagent-name]-[content].md
    ├── [nnnnnn]-[subagent-name]-[content].md
    └── ...
```

The `.agents/workspaces/[workspace-id]/` directory contains all reports and artifacts from a single agent work session.

## File Naming Convention

Files within a workspace use a structured naming pattern:

```
[nnnnnn]-[subagent-name]-[content].md
```

### File Name Components

| Component    | Format            | Example                  | Notes                                                           |
| ------------ | ----------------- | ------------------------ | --------------------------------------------------------------- |
| Sequence     | `[nnnnnn]`        | `000001`                 | 6-digit zero-padded integer, incremented per file               |
| Subagent     | `[subagent-name]` | `documentation-engineer` | Identifies which subagent created the file                      |
| Content Type | `[content]`       | `report`                 | Describes the file's purpose (e.g., `report`, `review`, `plan`) |

### File Name Examples

- `000001-documentation-engineer-report.md` — Initial report from documentation engineer
- `000002-code-review-assistant-review.md` — Code review from code review assistant
- `000003-api-designer-feedback.md` — Feedback from API designer

## Generation Tool

The `generate.ts` tool generates a properly formatted workspace ID:

```bash
./generate.ts [feature-name]
```

**Parameters:**

- `[feature-name]` — The kebab-case feature name for your workspace

**Output:**

- A valid workspace ID in the format `yyyymmdd-HHmm-[feature-name]`

**Example:**

```bash
./generate.ts doc-review
# Output: 20260302-1430-doc-review
```

## Good Examples

### Correct Workspace ID Usage

```
Workspace ID: 20260302-1430-doc-engine
Directory: .agents/workspaces/20260302-1430-doc-engine/
Files:
  - 000001-documentation-engineer-report.md
  - 000002-technical-writer-review.md
  - 000003-qa-expert-feedback.md
```

### Correct Feature Names

- `doc-engine` — Documentation system building
- `api-v2-migration` — API v2 migration work
- `fix-type-checking` — Type checking fixes
- `add-e2e-tests` — Adding end-to-end tests
- `refactor-auth` — Authentication refactoring

## Bad Examples

### Incorrect Workspace IDs

```
❌ 20260302-14:30-doc-engine       # Time format wrong (use HHmm, not HH:mm)
❌ 20260302-1430-docEngine        # Feature name not kebab-case (docEngine)
❌ 20260302-1430-doc_engine       # Feature name uses underscore (use hyphens)
❌ 2026-03-02-1430-doc-engine     # Date format wrong (use yyyymmdd)
```

### Incorrect Feature Names

- `docEngine` — Camel-case (must be kebab-case)
- `doc_engine` — Underscores (use hyphens only)
- `DOC-ENGINE` — Uppercase (must be lowercase)
- `2-doc-engine` — Starts with digit (must start with letter)
- `doc--engine` — Double hyphens (use single hyphens)

### Incorrect File Names

```
❌ 1-doc-engineer-report.md           # Only 1 digit (use 6)
❌ 000001-doc engineer-report.md      # Space in subagent name
❌ 000001_documentation_engineer_report.md  # Underscores (use hyphens)
❌ 000001-documentation-engineer     # Missing .md extension
```

## Persistence Across Auto Compact

Workspace-ids generated with this skill are automatically persisted. After Auto Compact or when resuming a session, the workspace-id is restored automatically.

## Special Notes

The `rounds/` directory structure (e.g., `rounds/[NNNN]/`) is specific to the plan plugin and is NOT part of the general workspace-id specification. Use workspace directories as defined above for standard agent work.

## Integration with Other Plugins

When creating workspaces for plugin-specific work:

- **plan plugin**: Creates `.agents/plans/` files and may organize rounds within workspaces
- **progress-tracker plugin**: Creates progress-tracker workspace files under `.agents/workspaces/[workspace-id]/`
- **code-review plugin**: Creates review reports under `.agents/workspaces/[workspace-id]/`
- **research plugin**: Creates research findings under `.agents/workspaces/[workspace-id]/`

All plugins use the same canonical workspace-id format defined by this skill.
