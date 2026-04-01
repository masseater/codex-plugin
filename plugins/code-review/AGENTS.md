# code-review Plugin Development Guide

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

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                         | Description                                                                                                                                                                                                                                                                                                                                      |
| ----- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| skill | code-review:check-pr         | Check PR status and take action. Use when checking PR review comments, analyzing CI failures, or responding to check-pr requests.                                                                                                                                                                                                                |
| skill | code-review:code-review      | Perform rigorous code review on recently created artifacts. Use when reviewing code quality after implementation.                                                                                                                                                                                                                                |
| skill | code-review:github-pr        | GitHub PR操作のユーティリティ。Use when fetching review comments, managing unresolved threads, checking CI status, or downloading logs for a PR.                                                                                                                                                                                                 |
| skill | code-review:organize-commits | 現在の変更を関心ごと単位で分析し、レビューしやすい論理的なコミットに整理します                                                                                                                                                                                                                                                                   |
| agent | ai-antipattern-reviewer      | Review AI-generated code for antipatterns. Detects hallucinated APIs, wiring gaps, assumption failures, copy-paste patterns, context fitness issues, integration pattern inconsistencies, fallback abuse, scope creep, dead/unused code, unnecessary backward compatibility, and decision traceability gaps. Use proactively after writing code. |
| agent | design-reviewer              | Review code from design and architecture perspective. Check single responsibility, circular dependencies, tight coupling, and over-abstraction. Use proactively after writing code.                                                                                                                                                              |
| agent | goal-validator               | Validate that changes fulfill the original objectives. Cross-reference progress-file with actual changes. Use after completing a task.                                                                                                                                                                                                           |
| agent | implementation-reviewer      | Review implementation quality. Check readability, naming, functional style, duplicate code, and magic numbers. Use proactively after writing code.                                                                                                                                                                                               |
| agent | type-safety-reviewer         | Review TypeScript type safety. Check for any type usage, proper type definitions, and type guards. Use proactively after writing TypeScript.                                                                                                                                                                                                     |

<!-- END:component-list -->
