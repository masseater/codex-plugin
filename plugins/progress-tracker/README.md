# progress-tracker - セッション進捗ファイルの自動作成・管理

セッション開始時と終了時に進捗ファイルを自動管理するプラグイン。

## インストール

```bash
/plugin marketplace add masseater/codex-plugin
/plugin install progress-tracker@masseater-plugins
```

## 開発時の注意事項

- SessionStart と Stop の両方で同じスクリプト（progress-hooks.ts）が実行される
- hooks/lib/config.ts に共通設定を配置
