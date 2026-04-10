# github-workflow Plugin Development Guide

Git/GitHub workflow support — branch status notification and CI watch hooks.

## Overview

Stop 時にブランチ状態とコンフリクトを通知し、git push 後に非同期で CI を監視するプラグイン。

## Development Commands

```bash
cd plugins/github-workflow

bun run check        # lint + format check
bun run check:fix    # auto-fix
bun run typecheck    # type check
```

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                    | Description                                                                                                    |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| agent | ci-watcher              | Monitor CI for pushed branches in the background. Check PR checks if PR exists, otherwise watch workflow runs. |
| hook  | auto-ci-watch           | PostToolUse (Bash)                                                                                             |
| hook  | check-branch-status     | Stop                                                                                                           |
| hook  | check-push-pr-conflicts | PostToolUse (Bash)                                                                                             |
| hook  | log-git-status          | Stop                                                                                                           |
| hook  | suggest-actions-update  | PostToolUse (Write\|Edit)                                                                                      |

<!-- END:component-list -->
