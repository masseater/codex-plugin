# workspace-id プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
エージェント作業ディレクトリの命名規約（workspace-id）を定義し、Auto Compact / resume 時に直近の workspace-id を復元するプラグイン。

## 開発コマンド

```bash
cd plugins/workspace-id

bun run check        # lint チェック（oxlint）
bun run check:fix    # 自動修正
bun run typecheck    # 型チェック
```

## Overview

- `skills/workspace-id/` — workspace-id フォーマット・ディレクトリ構造・ファイル命名規約の定義と生成スクリプト
- `hooks/entry/workspace-id-persist.ts` — SessionStart(compact/resume) で直近 workspace-id を復元

workspace-id は `generate.ts` 実行時に `.agents/` 配下の DB へ保存され、`workspace-id-persist` フックが復元する。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                      | Description                                                                                                                                         |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | workspace-id:workspace-id | Use when creating workspace directories for agent work. Defines the canonical workspace-id format, directory structure, and file naming convention. |
| hook  | workspace-id-persist      | SessionStart                                                                                                                                        |

<!-- END:component-list -->
