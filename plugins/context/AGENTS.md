# context プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
プロジェクトコンテキスト（CLAUDE.md, AGENTS.md, .claude/rules/）の管理・整理を支援するプラグイン。

## 概要

プロジェクトのコンテキストファイルを適切に管理・リファクタリングするためのスキルとフックを提供する。

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `context:migrate-to-agents-md`
- `context:refactor-context-file`
- `context:refactor-project-context`
- `context:update-markdown`
- `context:verify-context`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                              | Description                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | context:generate-docs-index       | Internal documentation-index generation workflow for direct invocation from context maintenance tasks.                                                                                                                                                                                                                                                                                                |
| skill | context:migrate-to-agents-md      | This skill should be used when the user asks to "migrate CLAUDE.md to AGENTS.md", "CLAUDE.mdをAGENTS.mdに移行", "AGENTS.mdへ移行", or wants Claude-specific project context converted to AGENTS.md with a small CLAUDE.md reference file.                                                                                                                                                             |
| skill | context:refactor-context-file     | This skill should be used when the user asks to "refactor context file", "split CLAUDE.md into skills/rules/hooks", "AGENTS.mdを分解", "コンテキストファイルを整理", or wants a single context file decomposed into Claude Code features.                                                                                                                                                             |
| skill | context:refactor-project-context  | This skill should be used when the user asks to "refactor project context", "AGENTS.mdを整理", "context filesを再構成", "project context audit", or wants all project context files reorganized for consistency.                                                                                                                                                                                      |
| skill | context:should-be-project-context | Internal project-context placement and consistency reference used by context refactoring and verification workflows.                                                                                                                                                                                                                                                                                  |
| skill | context:update-markdown           | This skill should be used when the user asks to "update this markdown", "review every section", "Markdownをセクションごとに更新", "ドキュメントを並列確認", or wants a markdown file audited and updated section by section.                                                                                                                                                                          |
| skill | context:verify-context            | Use when someone says "verify context file", "check if AGENTS.md is correct", "validate context accuracy", "audit CLAUDE.md", "check documentation truth", "are the docs accurate", or mentions "context verification" or "documentation audit". Treats all existing content as potentially incorrect, extracts every technical claim, and verifies each against the actual codebase and web sources. |
| hook  | redirect-claude-md-edit           | PreToolUse (`Write\|Edit`)                                                                                                                                                                                                                                                                                                                                                                            |

<!-- END:component-list -->
