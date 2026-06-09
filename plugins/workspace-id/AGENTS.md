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

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `workspace-id:workspace-id`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                      | Description                                                                                                                                                                                                       |
| ----- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | workspace-id:workspace-id | This skill should be used when the user asks to "create a workspace directory", "workspace-id", "作業ディレクトリを作成", "agent workspace", or wants canonical agent workspace naming and directory conventions. |
| hook  | workspace-id-persist      | SessionStart                                                                                                                                                                                                      |

<!-- END:component-list -->
