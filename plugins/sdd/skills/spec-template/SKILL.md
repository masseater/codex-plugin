---
name: sdd:spec-template
description: SDD仕様書テンプレートの初期化。`/sdd:spec init` で新しい仕様書を作成する時に使用。
---

SDD仕様書テンプレートを `specs/{spec}/` にコピーする。

## テンプレートコピースクリプト

```bash
./scripts/copy-templates.ts specs/{spec}
```

コピーされるファイル:

- `overview.md` - タスク概要、Phase構成、調査項目
- `specification.md` - 機能要件、非機能要件
- `technical-details.md` - 技術仕様、API設計

**注**: phase計画書は `/sdd:phase breakdown` 実行時に個別作成。
