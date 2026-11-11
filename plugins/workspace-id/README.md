# workspace-id

エージェント作業ディレクトリの命名規約（workspace-id）を定義し、Auto Compact / resume 時に同じセッションの workspace-id を復元するプラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install workspace-id
```

## 構成

- skill `workspace-id`: workspace-id の書式、ディレクトリ構造、ファイル命名規約と生成スクリプト
- hook `workspace-id-persist`: Auto Compact / resume のあと、同じセッションで生成した workspace-id を Claude に伝える
