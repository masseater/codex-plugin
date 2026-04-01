---
name: sdd:spec
description: SDD仕様書の作成・定義。init（骨格作成）、requirements（要件定義）、technical（技術設計）
argument-hint: <init|requirements|technical> [spec-name]
---

# SDD Spec

`$ARGUMENTS` の先頭トークンに応じて対応するファイルを実行:

- `init` → @./init.md
- `requirements` → @./requirements.md
- `technical` → @./technical.md
