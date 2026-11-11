# workspace-id

エージェント作業ディレクトリの命名規約（workspace-id）を定義し、Auto Compact / resume 時に直近の workspace-id を復元するプラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install workspace-id
```

## 構成

| 種別  | 名前                 | 説明                                                                |
| ----- | -------------------- | ------------------------------------------------------------------- |
| skill | workspace-id         | workspace-id フォーマット・ディレクトリ構造・ファイル命名規約の定義 |
| hook  | workspace-id-persist | SessionStart(compact/resume) で直近 workspace-id を復元             |
