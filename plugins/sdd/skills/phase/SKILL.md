---
name: sdd:phase
description: 'This skill should be used when the user asks to "plan phases", "break down a phase", "implement an SDD phase", "Phase構成", "Phase詳細計画", or wants SDD phase planning, breakdown, implementation, or insertion.'
argument-hint: <plan|breakdown|implement|insert> [spec-name] [args]
---

# SDD Phase

`$ARGUMENTS` の先頭トークンに応じて対応するファイルを実行:

- `plan` → @./plan.md
- `breakdown` → @./breakdown.md
- `implement` → @./implement.md
- `insert` → @./insert.md
