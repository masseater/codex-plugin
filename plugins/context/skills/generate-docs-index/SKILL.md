---
name: generate-docs-index
description: Auto-generate docs/index.md from docs/ directory contents. Use when adding, removing, or reorganizing documentation files, or when asked to generate a docs index.
---

# generate-docs-index

Auto-generate `docs/index.md` as a table of contents for the `docs/` directory.

## Philosophy

From devkit:standards — "Make documentation auto-generatable — hand-maintained docs always go stale."

`docs/index.md` must be fully derivable from the file system. Never hand-edit it.

## Execution

### 1. Scan

Glob `docs/**/*.md` excluding `docs/index.md` itself and any `node_modules/`.

### 2. Extract Metadata

For each file:

- **Path**: relative from project root (e.g. `docs/api/mutils.md`)
- **Title**: first `# heading` in the file. If none, use the filename without extension

### 3. Group by Directory

Group files by their parent directory under `docs/`:

- `docs/*.md` → top-level (no group header)
- `docs/api/*.md` → "API Reference" (derive display name from directory: kebab-case → Title Case)
- `docs/guides/*.md` → "Guides"
- etc.

Sort groups alphabetically. Within each group, sort files alphabetically.

### 4. Generate docs/index.md

Write the file with this structure:

```markdown
# Documentation Index

> Auto-generated. Do not edit manually.

## [Group Name]

| Document                  | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| [Title](relative/path.md) | First non-heading paragraph (truncated to ~80 chars) |
```

- Top-level files (directly under `docs/`) appear first, without a group header
- Description: extract the first non-empty, non-heading line after the title. Truncate at 80 characters with `...` if longer. If no description found, leave empty
- Links use paths relative to `docs/` (e.g. `api/mutils.md`, not `docs/api/mutils.md`)

### 5. Write Only If Changed

Compare generated content with existing `docs/index.md`. Write only if different. Report whether the file was updated or already in sync.

## Integration

This skill should be invoked:

- After running `refactor-project-context` if docs were modified
- When the user adds or reorganizes documentation
- As part of any documentation audit workflow
