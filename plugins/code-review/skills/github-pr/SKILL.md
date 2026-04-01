---
name: code-review:github-pr
description: GitHub PR操作のユーティリティ。Use when fetching review comments, managing unresolved threads, checking CI status, or downloading logs for a PR.
---

GitHub Pull Request の操作を効率化するユーティリティ集。

いずれも `./scripts/<scriptName>` に配置されている。

| スクリプト                  | 説明                             |
| --------------------------- | -------------------------------- |
| `get-unresolved-threads.ts` | 未解決スレッドID一覧を取得       |
| `get-comments-by-thread.ts` | スレッドIDからコメント詳細を取得 |
| `get-ci-status.ts`          | PRのCI状態を取得                 |
| `get-ci-logs.ts`            | CIジョブのログをダウンロード     |

使用する際は `<script> --help` を実行し、使い方を把握してから使用すること。

## 共有ライブラリ

`lib/pr-info.ts` に `getCurrentPRInfo()` を提供。現在のブランチに紐づくPR情報（owner, repo, pr, headSha）を自動取得する。各スクリプトから内部的に使用されている。
