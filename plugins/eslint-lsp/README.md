# eslint-lsp - ESLint 9 Language Server 統合

セッション開始時に ESLint LSP サーバーの状態を確認するプラグイン。

## インストール

```bash
/plugin marketplace add masseater/codex-plugin
/plugin install eslint-lsp@masseater-plugins
```

## 開発時の注意事項

- ESLint 9 以降が対象
- LSP サーバーが起動していない場合は警告を出力
- `.lsp.json` で ESLint サーバーの設定を管理
