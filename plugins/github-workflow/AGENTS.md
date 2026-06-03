# github-workflow Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Git/GitHub workflow support — branch status notification and CI watch hooks.

## Overview

Stop 時にブランチ状態とコンフリクトを通知し、git push 後に非同期で CI を監視するプラグイン。

Version 更新は master への plugin 変更 merge 後に Auto Version Bump workflow が担当する。

## Development Commands

```bash
cd plugins/github-workflow

bun run check        # lint + format check
bun run check:fix    # auto-fix
bun run typecheck    # type check
```

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                         | Description                                                                                                                                                                                                                                                                                                                |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | github-workflow:create-issue | Create a GitHub issue in the current repository with a drafted title, body, and labels, confirming with the user before submission. Use when the user says "issueを作成", "GitHub issueを立てる", "create issue", "新しいissue", "バグ報告issue", or wants to file a new issue from conversation or investigation context. |
| agent | ci-watcher                   | Monitor CI and PR merge conflict status for pushed branches in the background.                                                                                                                                                                                                                                             |
| hook  | auto-ci-watch                | PostToolUse (`Bash`)                                                                                                                                                                                                                                                                                                       |
| hook  | check-branch-status          | Stop                                                                                                                                                                                                                                                                                                                       |
| hook  | check-push-pr-conflicts      | PostToolUse (`Bash`)                                                                                                                                                                                                                                                                                                       |
| hook  | suggest-actions-update       | PostToolUse (`Write\|Edit`)                                                                                                                                                                                                                                                                                                |

<!-- END:component-list -->
