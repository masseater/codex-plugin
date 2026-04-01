# sdd - Spec Driven Development ワークフロー支援

仕様書に基づいた段階的な実装を支援するプラグイン。

## インストール

```bash
/plugin marketplace add masseater/codex-plugin
/plugin install sdd@masseater-plugins
```

## 開発時の注意事項

- `specs/_archived/` 配下のファイル編集は block-archived-edit.ts でブロックされる
- ステアリングドキュメントは Progressive Disclosure により文脈に応じて自動参照される
- sdd-webapp は steering 実行時に自動登録される
