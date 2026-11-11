# sdd プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
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

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `sdd:archive`
- `sdd:autopilot`
- `sdd:help`
- `sdd:next`
- `sdd:phase`
- `sdd:quality-check`
- `sdd:research`
- `sdd:spec`
- `sdd:status`
- `sdd:steering`
- `sdd:sync`
- `sdd:validate`
- `sdd:webapp-integration`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                   | Description                                                                                                                                                                                                                  |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | sdd:archive            | This skill should be used when the user asks to "archive a completed spec", "specをアーカイブ", "完了タスクをアーカイブ", "archive SDD task", or wants completed/rejected specs moved into the SDD archived specs directory. |
| skill | sdd:autopilot          | This skill should be used when the user asks to "run SDD on autopilot", "自動で進めて", "一気に実装", "autopilot", or wants the SDD workflow advanced with minimal human intervention.                                       |
| skill | sdd:help               | This skill should be used when the user asks for "SDD help", "SDDの使い方", "SDDワークフローを説明", "what is the next SDD command", or wants an overview of the SDD workflow.                                               |
| skill | sdd:next               | This skill should be used when the user asks "what should I do next", "次に何をすればいい", "SDD next", "次のSDDステップ", or wants the next action inferred from the current specs state.                                   |
| skill | sdd:phase              | This skill should be used when the user asks to "plan phases", "break down a phase", "implement an SDD phase", "Phase構成", "Phase詳細計画", or wants SDD phase planning, breakdown, implementation, or insertion.           |
| skill | sdd:quality-check      | This skill should be used when the user asks to "quality check a spec", "仕様書の品質チェック", "矛盾検出", "ステアリング準拠確認", or wants SDD documents checked for contradictions and steering compliance.               |
| skill | sdd:research           | This skill should be used when the user asks to "conduct SDD research", "調査を実施", "不明点を明確化", "research clarify", or wants technical investigation or clarification for an SDD spec.                               |
| skill | sdd:spec               | This skill should be used when the user asks to "create an SDD spec", "仕様書を作成", "要件定義", "技術設計", "spec init", or wants SDD overview, requirements, or technical-details documents created.                      |
| skill | sdd:status             | This skill should be used when the user asks for "SDD status", "タスクのステータス", "進捗を見せて", "spec一覧", or wants all SDD task statuses displayed.                                                                   |
| skill | sdd:steering           | This skill should be used when the user asks to "define project steering", "プロジェクト方針を定義", "技術スタックを整理", "steering", or wants persistent SDD project context initialized or migrated.                      |
| skill | sdd:sync               | This skill should be used when the user asks to "sync implementation status", "実装状況を仕様書に同期", "SDD sync", "進捗をドキュメントに反映", or wants current code progress reflected in SDD spec documents.              |
| skill | sdd:validate           | This skill should be used when the user asks to "validate a phase", "Phase検証", "SDD validate", "実装を検証", or wants docs, requirements, quality, and feasibility checks for an SDD phase.                                |
| skill | sdd:webapp-integration | This skill should be used when the user asks about "sdd-webapp", "SDD dashboard", "ダッシュボード", "進捗を可視化", or wants to use sdd-webapp MCP tools for spec status visibility.                                         |
| skill | sdd:workflow           | SDDワークフロー全体のガイド。SDD コマンドを実行する時に、全てのコマンドで読み込む必要がある。                                                                                                                                |
| agent | contradiction-checker  | Detect contradictions between spec documents (overview, specification, technical-details, phase files). Reports inconsistencies without making fixes.                                                                        |
| agent | steering-reviewer      | Review code and documents for compliance with steering documents. Reports deviations without making fixes.                                                                                                                   |
| hook  | block-archived-edit    | PreToolUse (`Write\|Edit`)                                                                                                                                                                                                   |
| hook  | require-phase-status   | PreToolUse (`Write\|Edit`)                                                                                                                                                                                                   |

<!-- END:component-list -->
