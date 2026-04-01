# context プラグイン開発ガイド

プロジェクトコンテキスト（CLAUDE.md, AGENTS.md, .claude/rules/）の管理・整理を支援するプラグイン。

## 概要

プロジェクトのコンテキストファイルを適切に管理・リファクタリングするためのスキルとフックを提供する。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                              | Description                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | context:migrate-to-agents-md      | CLAUDE.mdをAGENTS.mdにマイグレーション                                                                                                                                                                                                                                                                                                                                                                |
| skill | context:refactor-context-file     | コンテキストファイル（CLAUDE.md/AGENTS.md）をClaude Codeの各機能に分解・リファクタリングする                                                                                                                                                                                                                                                                                                          |
| skill | context:should-be-project-context | Analyze project context files and maintain consistency. Use when updating, organizing, or auditing project context files (AGENTS.md, README.md, gotchas.md, etc.).                                                                                                                                                                                                                                    |
| skill | context:update-markdown           | Markdownファイルの見出しを読み込み、セクションごとに並列で内容確認・更新提案                                                                                                                                                                                                                                                                                                                          |
| skill | generate-docs-index               | Auto-generate docs/index.md from docs/ directory contents. Use when adding, removing, or reorganizing documentation files, or when asked to generate a docs index.                                                                                                                                                                                                                                    |
| skill | refactor-project-context          | Use when scanning and reorganizing all project context files (AGENTS.md, README.md, gotchas.md, .claude/rules/) for consistency, accuracy, and structural alignment.                                                                                                                                                                                                                                  |
| skill | verify-context                    | Use when someone says "verify context file", "check if AGENTS.md is correct", "validate context accuracy", "audit CLAUDE.md", "check documentation truth", "are the docs accurate", or mentions "context verification" or "documentation audit". Treats all existing content as potentially incorrect, extracts every technical claim, and verifies each against the actual codebase and web sources. |
| hook  | redirect-claude-md-edit           | PreToolUse (Write\|Edit)                                                                                                                                                                                                                                                                                                                                                                              |

<!-- END:component-list -->
