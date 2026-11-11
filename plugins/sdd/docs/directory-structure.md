# SDD Directory Structure

ユーザープロジェクトに生成されるファイル:

```text
.claude/skills/steering/   # プロジェクトのステアリング（/sdd:steering が作る）
├── SKILL.md
├── product.md             # プロダクト方針
├── tech.md                # 技術スタック
├── structure.md           # プロジェクト構造
└── principles.md          # 開発原則

specs/
├── research/              # 調査結果（/sdd:spec research が作る）
├── {spec}/
│   ├── overview.md        # frontmatter の status、調査項目、Phase 構成
│   ├── specification.md
│   ├── technical-details.md
│   └── phases/
│       └── phase{N}-{name}.md   # frontmatter の status、タスクのチェックボックス
└── _archived/             # アーカイブ済み spec（hook で編集不可）
```
