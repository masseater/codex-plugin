---
name: sdd:spec
description: 'This skill should be used when the user asks to "create an SDD spec", "仕様書を作成", "要件定義", "技術設計", "spec init", or wants SDD overview, requirements, or technical-details documents created.'
argument-hint: <init|requirements|technical> [spec-name]
---

# SDD Spec

`$ARGUMENTS` の先頭トークンに応じて対応するファイルを実行:

- `init` → @./init.md
- `requirements` → @./requirements.md
- `technical` → @./technical.md
