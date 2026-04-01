# AGENTS.md Template

## Directory Structure in AGENTS.md

Model: [Next.js Project Structure](https://nextjs.org/docs/getting-started/project-structure)

Next.js documents structure as categorized tables that define **what each name means** at every level — not just top-level directories, but also nested conventions, special files within those directories, and pattern-based naming rules.

AGENTS.md should follow the same approach:

1. **Top-level Directories** — what each directory is for
2. **Top-level Files** — configuration and manifest files
3. **Directory-scoped Conventions** — special files that have meaning inside specific directories (like `layout.tsx` inside `app/`)
4. **Naming Patterns** — glob/dynamic patterns and what they mean (like `[slug]` in Next.js)

### What goes in AGENTS.md vs docs/directory-structure.md

| AGENTS.md                                | docs/directory-structure.md        |
| ---------------------------------------- | ---------------------------------- |
| Category tables defining what names mean | Full tree views (`├──` format)     |
| Convention patterns with glob syntax     | Exhaustive per-file listings       |
| One-line descriptions per entry          | Detailed explanations and examples |

### Example: Claude Code Plugin project

```markdown
## Structure

### Top-level Directories

| Directory         | Description                                       |
| ----------------- | ------------------------------------------------- |
| `plugins/`        | Plugin packages (commands, skills, hooks, agents) |
| `packages/`       | Shared libraries published to npm                 |
| `scripts/`        | Doc generation and Git hook scripts               |
| `docs/`           | Auto-generated documentation                      |
| `specs/`          | SDD spec files                                    |
| `.claude-plugin/` | Marketplace definition                            |

### Top-level Files

| File           | Description                           |
| -------------- | ------------------------------------- |
| `AGENTS.md`    | AI agent guide (SSOT for the project) |
| `package.json` | Workspace root manifest               |
| `lefthook.yml` | Git hook orchestration                |

### Plugin Directory Conventions (`plugins/*/`)

| File/Directory          | Description                                 |
| ----------------------- | ------------------------------------------- |
| `plugin.json`           | Plugin manifest (name, version, hooks path) |
| `AGENTS.md`             | Plugin-specific AI agent guide              |
| `hooks/hooks.json`      | Hook event → command mapping                |
| `hooks/*.ts`            | Hook scripts (must be chmod +x)             |
| `skills/*/SKILL.md`     | Skill definition with YAML frontmatter      |
| `agents/*.md`           | Sub-agent definition with YAML frontmatter  |
| `commands/*/COMMAND.md` | Slash command definition                    |
| `lib/`                  | Shared library code within the plugin       |

### File Naming Conventions

| Pattern      | Description                                              |
| ------------ | -------------------------------------------------------- |
| `CLAUDE.md`  | Always `@AGENTS.md` reference — never standalone content |
| `*.test.ts`  | Test file (co-located with source)                       |
| `__tests__/` | Test directory (FSD convention)                          |

For detailed directory tree, see [docs/directory-structure.md](docs/directory-structure.md).
```

### Key principles

- **Category per heading** — don't dump everything into one flat table
- **Scope conventions to their parent** — `skills/*/SKILL.md` belongs under "Plugin Directory Conventions", not top-level
- **Describe meaning, not content** — `plugin.json` = "Plugin manifest" not "JSON file with name and version fields"
- **One line per entry** — if it needs more, it belongs in docs/
- **Glob patterns for repeating structures** — `plugins/*/`, `skills/*/SKILL.md`, `hooks/*.ts`

## Root AGENTS.md template

<!-- Root AGENTS.md Template Start -->

```markdown
# AGENTS.md

Essential guidelines for working on this project.

## Project Overview

Explain the project's purpose in 2-3 sentences.

## Structure

### Top-level Directories

| Directory       | Description                         |
| --------------- | ----------------------------------- |
| `src/`          | Application source code             |
| `packages/xxx/` | One-line description of the package |

### Top-level Files

| File           | Description                           |
| -------------- | ------------------------------------- |
| `package.json` | Project manifest and workspace config |

### Directory Conventions (`src/`)

| File/Directory | Description                       |
| -------------- | --------------------------------- |
| ...            | Project-specific conventions here |

### File Naming Conventions

| Pattern     | Description                             |
| ----------- | --------------------------------------- |
| `AGENTS.md` | AI agent guide (SSOT for the directory) |
| `*.test.ts` | Co-located test file                    |

For detailed directory tree, see [docs/directory-structure.md](docs/directory-structure.md).

## Development Commands

\`\`\`bash
bun run check # lint + format check
bun run check:fix # auto-fix
bun run typecheck # type check
\`\`\`

> Development command last updated: YYYY-MM-DD

## Important Instructions

- Project-specific important rules
- Constraints to follow

## Skills

| Skill             | Description       |
| ----------------- | ----------------- |
| `/xxx:skill-name` | Skill description |

## MCP Servers

## Related Projects
```

<!-- Root AGENTS.md Template End -->

## Subdirectory AGENTS.md template

<!-- Subdirectory AGENTS.md Template Start -->

```markdown
# [Package Name] Development Guide

## Overview

Purpose and responsibilities of this package.

## Structure

| Directory | Description |
| --------- | ----------- |
| `src/`    | Source code |

## Development Commands

\`\`\`bash
bun run check # lint + format
\`\`\`

> Development command last updated: YYYY-MM-DD

## API / Exports

List of main exports with brief descriptions.

## Environment Variables

| Variable      | Description | Required |
| ------------- | ----------- | -------- |
| `XXX_API_KEY` | API key     | Yes      |

## Notes

- Package-specific notes

## Skills and MCP Servers Used

## Dependencies
```

<!-- Subdirectory AGENTS.md Template End -->
