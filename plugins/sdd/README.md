# sdd - Spec Driven Development ワークフロー支援

仕様書に基づいた段階的な実装を支援するプラグイン。

## インストール

```bash
/plugin marketplace add masseater/codex-plugin
/plugin install sdd@masseater-plugins
```

## 使い方

1. `/sdd:steering` — プロジェクトの方針を `.claude/skills/steering/` に作る（初回のみ）
2. `/sdd:spec init <作りたいもの>` — spec を作り、`research` → `requirements` → `technical` → `clarify` で埋めて、`/sdd:validate spec <spec>` で検証する
3. `/sdd:phase plan <spec>` — Phase に分け、Phase ごとに `breakdown` → `implement` → `/sdd:validate phase` を回す
4. `/sdd:archive` — 完了した spec をアーカイブする

次に何をするかは `/sdd:status` が示す。流れの全体は [docs/workflow-diagram.md](docs/workflow-diagram.md)。

## 開発時の注意事項

- `specs/_archived/` 配下のファイル編集は block-archived-edit.ts でブロックされる
- ステアリングドキュメントは Progressive Disclosure により文脈に応じて自動参照される
- sdd-webapp へのプロジェクト登録は `/sdd:spec init` が行う（webapp は `specs/` があるプロジェクトしか登録できないため）
