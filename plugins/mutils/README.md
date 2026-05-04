# mutils - masseater's utils

開発支援コマンド・スキル・Hooksを提供する汎用ユーティリティプラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install mutils
```

初回インストール後は `/mutils:setup` でセットアップを実行してください。

---

## Hooks

| イベント     | フック                      | 説明                                 |
| ------------ | --------------------------- | ------------------------------------ |
| SessionStart | bun install --production    | 依存関係の自動インストール           |
| SessionStart | check-context-version       | コンテキストファイルのバージョン確認 |
| SessionStart | workspace-id-persist        | 直近 workspace-id の復元             |
| PreToolUse   | block-unsafe-type-assertion | 危険な型アサーションのブロック       |
| PreToolUse   | block-husky-bypass          | HUSKY=0 による hooks バイパスを阻止  |
| PostToolUse  | task-history                | TODO/Task 操作履歴を DB に永続化     |
| Stop         | send-notification           | 完了通知の送信                       |

---

## スキル

| スキル                   | 説明                                          |
| ------------------------ | --------------------------------------------- |
| setup                    | 初回セットアップ                              |
| recommended              | おすすめの設定・プラグイン・MCPサーバーを紹介 |
| pls-auq                  | 効果的な質問の仕方ガイド                      |
| reflection               | 作業振り返り・知見抽出                        |
| issue-plan               | GitHub Issueから実装計画を自動生成            |
| multi-angle-perspectives | 3つの観点から合計6つの提案を生成              |
| dig                      | 深掘り調査                                    |

---

## ロギング

Hooks は `$XDG_STATE_HOME/masseater-plugins/` にログを出力します（デフォルト: `~/.local/state/masseater-plugins/`）。

---

## 関連プラグイン

mutils から分離された専門プラグイン:

| プラグイン  | 説明                                       |
| ----------- | ------------------------------------------ |
| context     | プロジェクトコンテキスト管理               |
| code-review | PR・コードレビューワークフロー支援         |
| research    | 調査・分析ツール                           |
| techstack   | 技術スタック管理・準拠チェック             |
| cc-hooks-ts | cc-hooks-ts ライブラリガイド・Hook作成支援 |

## 参考資料

- [Claude Code プラグインドキュメント](https://code.claude.com/docs/en/plugins)
- [Claude Code Hooksドキュメント](https://code.claude.com/docs/en/hooks)
- [cc-hooks-ts GitHub](https://github.com/sushichan044/cc-hooks-ts)
