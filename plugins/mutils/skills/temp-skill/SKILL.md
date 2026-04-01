---
name: temp-skill
description: Save and manage temporary notes across sessions. Triggered by phrases like "save temp", "add temp", "list temp", "search temp", "read temp", "show temp", or their Japanese equivalents ("一時メモ", "temp に保存", "temp 一覧", "temp 検索", "temp 読む", etc.). Saves as Markdown files in ~/.claude/skills/temp/ with index management.
tools:
  - Bash(./scripts/update-index.ts *)
  - Read
  - Write
  - Glob
  - Grep
---

# temp-skill

Save and manage temporary notes across sessions. Notes are stored in `~/.claude/skills/temp/` as Markdown files and cataloged in the Index section below.

**IMPORTANT**: After updating SKILL.md, always reload `temp-skill` via the Skill tool to reflect the latest index.

---

## Workflows

### Add

Trigger: "save temp", "add temp", "一時メモ", "temp に保存"

1. Create `~/.claude/skills/temp/` directory if it does not exist
2. Create `~/.claude/skills/temp/YYYY-MM-DD-short-name.md` with frontmatter (`name`, `description`, `created`, `tags`) and content
3. Run `./scripts/update-index.ts`

### List

Trigger: "list temp", "temp 一覧"

Read the **Index** section below, or Glob `~/.claude/skills/temp/*.md`.

### Search

Trigger: "search temp", "temp 検索", "find temp"

Grep the `~/.claude/skills/temp/` directory by keyword. For tags: `tags:.*tagname`.

### Read

Trigger: "read temp", "show temp", "temp 読む"

Find the target from the Index, then Read the file.

---

## Index

<!-- INDEX_START -->

(No entries yet)

<!-- INDEX_END -->
