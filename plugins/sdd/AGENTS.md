# sdd プラグイン開発ガイド

SDD（Spec-Driven Development）ワークフロー支援プラグイン。仕様書に基づいた段階的な実装を支援する。

## ディレクトリ構造

ユーザープロジェクトに生成されるファイル: see [docs/directory-structure.md](docs/directory-structure.md)

## MCP Server

`@r_masseater/sdd-webapp` パッケージで提供。steering スキル実行時に登録。

利用可能なツール:

- sdd_webapp_add_project（steering時に呼び出し）
- sdd_webapp_list_projects
- sdd_webapp_remove_project
- sdd_webapp_get_status
- sdd_webapp_set_phase
- sdd_webapp_delete_phase

## 注意事項

- `specs/_archived/` 配下のファイル編集は block-archived-edit.ts でブロック
- ステアリングドキュメントは Progressive Disclosure により文脈に応じて自動参照
- sdd-webappはsteering時に登録

## SDD ワークフロー

Full workflow diagram: see [docs/workflow-diagram.md](docs/workflow-diagram.md)

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                   | Description                                                                                                                                           |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | sdd:archive            | 完了または不要になったspecsをアーカイブします                                                                                                         |
| skill | sdd:autopilot          | SDD自動進行モードのガイド。以下の状況で使用する:                                                                                                      |
| skill | sdd:help               | SDDワークフローのヘルプ表示                                                                                                                           |
| skill | sdd:next               | 次に実行すべきコマンドを提案                                                                                                                          |
| skill | sdd:phase              | SDDのPhase管理。plan（構成決定）、breakdown（詳細計画）、implement（実装）、insert（Phase挿入）                                                       |
| skill | sdd:quality-check      | 仕様書の品質チェック（矛盾検出・ステアリング準拠確認）                                                                                                |
| skill | sdd:research           | SDD調査・明確化。conduct（技術調査の実施）、clarify（不明箇所のユーザー質問）                                                                         |
| skill | sdd:spec               | SDD仕様書の作成・定義。init（骨格作成）、requirements（要件定義）、technical（技術設計）                                                              |
| skill | sdd:spec-template      | SDD仕様書テンプレートの初期化。`/sdd:spec init` で新しい仕様書を作成する時に使用。                                                                    |
| skill | sdd:status             | 全タスクのステータス表示                                                                                                                              |
| skill | sdd:steering           | プロジェクトのステアリングドキュメント（永続的コンテキスト）の初期化・移行ガイド。以下の状況で使用:                                                   |
| skill | sdd:sync               | 実装状況を仕様書に同期                                                                                                                                |
| skill | sdd:validate           | Phase検証スキル。ドキュメント・要件・品質の3観点から統合検証を実施。/sdd:validate コマンド実行時に参照。                                              |
| skill | sdd:webapp-integration | sdd-webappとの連携ガイド。以下の状況で使用する:                                                                                                       |
| skill | sdd:workflow           | SDDワークフロー全体のガイド。SDD コマンドを実行する時に、全てのコマンドで読み込む必要がある。                                                         |
| agent | contradiction-checker  | Detect contradictions between spec documents (overview, specification, technical-details, phase files). Reports inconsistencies without making fixes. |
| agent | steering-reviewer      | Review code and documents for compliance with steering documents. Reports deviations without making fixes.                                            |
| hook  | block-archived-edit    | PreToolUse (`Write\|Edit`)                                                                                                                            |
| hook  | require-phase-status   | PreToolUse (`Write\|Edit`)                                                                                                                            |

<!-- END:component-list -->
