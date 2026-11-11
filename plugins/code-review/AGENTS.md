# code-review Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
PR and code review workflow support plugin.

## Overview

Provides skills, agents, and hooks for code review workflows including PR creation, review, CI monitoring, and commit organization.

## Development Commands

```bash
cd plugins/code-review

bun run check        # lint + format check
bun run check:fix    # auto-fix
bun run typecheck    # type check
```

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `code-review:check-pr`
- `code-review:code-review`
- `code-review:organize-commits`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                         | Description                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| skill | code-review:check-pr         | This skill should be used when the user asks to "check PR", "PRの状態を確認", "review comments", "CI failures", or wants PR review comments, CI status, or check-pr actions inspected.                                                                                                                                                           |
| skill | code-review:code-review      | This skill should be used when the user asks for "code review", "レビューして", "review this diff", "実装をレビュー", or wants rigorous review of recently created artifacts.                                                                                                                                                                    |
| skill | code-review:github-pr        | Direct utility reference for code-review PR scripts. Documents unresolved-thread, comment, CI-status, and CI-log helpers used by higher-level PR workflows.                                                                                                                                                                                      |
| skill | code-review:organize-commits | This skill should be used when the user asks to "organize commits", "split this diff into commits", "コミットを整理", "レビューしやすいコミット", or wants current changes grouped into logical commits.                                                                                                                                         |
| agent | ai-antipattern-reviewer      | Review AI-generated code for antipatterns. Detects hallucinated APIs, wiring gaps, assumption failures, copy-paste patterns, context fitness issues, integration pattern inconsistencies, fallback abuse, scope creep, dead/unused code, unnecessary backward compatibility, and decision traceability gaps. Use proactively after writing code. |
| agent | design-reviewer              | Review code from design and architecture perspective. Check single responsibility, circular dependencies, tight coupling, and over-abstraction. Use proactively after writing code.                                                                                                                                                              |
| agent | goal-validator               | Validate that changes fulfill the original objectives. Cross-reference progress-file with actual changes. Use after completing a task.                                                                                                                                                                                                           |
| agent | implementation-reviewer      | Review implementation quality. Check readability, naming, functional style, duplicate code, and magic numbers. Use proactively after writing code.                                                                                                                                                                                               |
| agent | type-safety-reviewer         | Review TypeScript type safety. Check for any type usage, proper type definitions, and type guards. Use proactively after writing TypeScript.                                                                                                                                                                                                     |

<!-- END:component-list -->
