# mutils - masseater's utils

開発支援コマンド・スキル・Hooksを提供する汎用ユーティリティプラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install mutils
```

初回インストール後は `/mutils:setup` でセットアップを実行してください。

---

## Hooks・スキル一覧

Hooks・スキルの完全な一覧は自動生成され常に最新に保たれている [AGENTS.md](AGENTS.md#components) の Components セクションを参照する。このファイルに個別の一覧を重複して保持しない（重複はドリフトの原因になるため）。

---

## ロギング

Hooks は `$XDG_STATE_HOME/masseater-plugins/` にログを出力します（デフォルト: `~/.local/state/masseater-plugins/`）。

---

## 関連プラグイン

mutils から分離された専門プラグイン:

| プラグイン  | 説明                                                   |
| ----------- | ------------------------------------------------------ |
| context     | プロジェクトコンテキスト管理                           |
| research    | 調査・分析ツール                                       |
| devkit      | 技術スタック定義・プロジェクトセットアップ・品質自動化 |
| cc-hooks-ts | cc-hooks-ts ライブラリガイド・Hook作成支援             |

## 参考資料

- [Claude Code プラグインドキュメント](https://code.claude.com/docs/en/plugins)
- [Claude Code Hooksドキュメント](https://code.claude.com/docs/en/hooks)
- [cc-hooks-ts GitHub](https://github.com/sushichan044/cc-hooks-ts)
