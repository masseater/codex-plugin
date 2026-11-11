# CCS プラグイン

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
CCS (Claude Code Sessions) 環境の自動設定・セッション管理・委譲ワークフローを提供するプラグイン。

## 機能

- **SessionStart hook**: CCS シンボリックリンクチェーンの自動検証・修復
- **ccs-handoff スキル**: プロファイル間のセッション引き継ぎ
- **ccs-delegation スキル**: 最適プロファイル選択による CCS CLI 委譲
- **/ccs コマンド**: インテリジェントプロファイル選択による委譲
- **/ccs:continue コマンド**: 前回セッションの継続

## 開発コマンド

```bash
cd plugins/ccs
bun run check        # lint チェック
bun run check:fix    # 自動修正
bun run typecheck    # 型チェック
```

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name               | Description                                                                                                                                                                                                        |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| skill | ccs:ccs-delegation | Auto-activate CCS CLI delegation for deterministic tasks. Parses user input,                                                                                                                                       |
| skill | ccs:ccs-handoff    | This skill should be used when the user asks to "handoff from CCS", "Claude Codeの作業を引き継ぐ", "rate limit handoff", "context overflow", or wants to resume interrupted work from another CCS profile session. |
| hook  | ccs-symlink-check  | SessionStart                                                                                                                                                                                                       |

<!-- END:component-list -->
