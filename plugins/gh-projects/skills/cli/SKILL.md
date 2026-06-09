---
name: gh-projects:cli
description: 'This skill should be used when the user asks to operate GitHub Projects through the plugin CLI, "GitHub Projects CLI", "Project CRUD", "sub-issue を操作", "blocked-by を設定", or needs the gh-project.ts execution reference for Project, sub-issue, and dependency operations.'
---

# GitHub Projects CLI

`gh` CLI と GraphQL を薄くラップした CLI で、Projects (v2) と Issue の階層・依存関係を扱う。

スクリプトは `../../scripts/gh-project.ts` にあり、shebang (`#!/usr/bin/env bun`) を持つので Bun ランタイムがあれば直接実行できる。

## Prerequisite

```bash
gh auth refresh -s project
```

`project` スコープが無いと Projects v2 / Issue Dependencies の GraphQL ミューテーションがすべて失敗する。

## Invocation

```bash
../../scripts/gh-project.ts <command> [args]
```

shell から呼ぶ場合は `gh-project.ts` を実行可能にして PATH を通すか、フルパスで呼ぶ。

## Commands

### Project CRUD

| Command          | Args                                        | Description                                                        |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `project:list`   | `<owner>`                                   | owner（org / user）の Projects 一覧                                |
| `project:create` | `<owner>` または `<owner>/<repo>` `<title>` | 新規 Project を作成。repo 形式を渡すと repo に link した状態で作成 |
| `project:view`   | `<owner> <number>`                          | Project をブラウザで開く                                           |

### Project Items

| Command      | Args                                                  | Description                                                   |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| `item:list`  | `<owner> <project-number>`                            | Project に登録された Issue/PR/Draft を一覧                    |
| `item:add`   | `<owner> <project-number> <issue-or-pr-url>`          | 既存 Issue/PR を Project に追加                               |
| `field:list` | `<owner> <project-number>`                            | Project の Field 定義（Status、Iteration、Custom など）を表示 |
| `status:set` | `<owner> <project-number> <issue-url> <status-value>` | Issue の Project item の Status（single-select）を設定        |

`status:set` は `<status-value>`（例: `Need Review`）が Project の Status Field の option として存在する必要がある。無い場合は利用可能な option 名を列挙してエラーになる。

### Sub-Issues

GitHub の sub-issue は親子 Issue を構造化するネイティブ機能。EPIC → Story → Task のような階層に対応する。

| Command            | Args                                | Description                               |
| ------------------ | ----------------------------------- | ----------------------------------------- |
| `sub-issue:add`    | `<owner>/<repo> <parent#> <child#>` | child を parent の sub-issue として紐付け |
| `sub-issue:remove` | `<owner>/<repo> <parent#> <child#>` | sub-issue 関係を解除                      |
| `sub-issue:list`   | `<owner>/<repo> <issue#>`           | 指定 Issue の親・子・完了率を表示         |

### Blocking / Dependencies

GitHub の Issue Dependencies は「この Issue は他の Issue に blocked-by/blocking されている」を構造化する。階層をまたいだ依存（別 Story の Task が前提など）に使う。

| Command        | Args                                    | Description                                                          |
| -------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `block:add`    | `<owner>/<repo> <blocked#> <blocking#>` | blocked が blocking に依存することをマーク                           |
| `block:remove` | `<owner>/<repo> <blocked#> <blocking#>` | blocked-by 関係を解除                                                |
| `deps:show`    | `<owner>/<repo> <issue#>`               | 親 / 子 / blocked-by / blocking / tracked-in / tracking を一覧で出力 |

### Tracked Issues (read-only)

| Command        | Args                      | Description                                                           |
| -------------- | ------------------------- | --------------------------------------------------------------------- |
| `tracked:list` | `<owner>/<repo> <issue#>` | チェックリストやタスクリストで参照されている tracked-issue 関係を一覧 |

## Output Conventions

- `deps:show` は人間可読のセクション分け（`Parent`, `Sub-issues`, `Blocked by`, `Blocking`, `Tracked in`, `Tracking`）
- 失敗時は GraphQL のエラーメッセージをそのまま throw する（プロセス exit 1）

## Error Handling

| 症状                                                      | 原因                                          | 対処                              |
| --------------------------------------------------------- | --------------------------------------------- | --------------------------------- |
| `Resource not accessible by integration`                  | `project` スコープ不足                        | `gh auth refresh -s project`      |
| `Could not resolve to a node with the global id of '...'` | Issue が closed/deleted、または別 repo の番号 | repo と番号を確認                 |
| `addSubIssue` が `INVALID_ARGUMENT`                       | 既に別 parent に紐付いている、または循環参照  | `sub-issue:list` で現在の親を確認 |
| `addBlockedBy` が `INVALID_ARGUMENT`                      | 依存先が自己参照 / 既に登録済み               | `deps:show` で現状を確認          |

## Example

```bash
# 1. Project を作成
./scripts/gh-project.ts project:create acme/web "Q3 Roadmap"

# 2. EPIC Issue を Project に追加
./scripts/gh-project.ts item:add acme 7 https://github.com/acme/web/issues/100

# 3. Story を EPIC の sub-issue に
./scripts/gh-project.ts sub-issue:add acme/web 100 101
./scripts/gh-project.ts sub-issue:add acme/web 100 102

# 4. Story 102 は Story 101 完了が前提
./scripts/gh-project.ts block:add acme/web 102 101

# 5. EPIC #100 の現状を可視化
./scripts/gh-project.ts deps:show acme/web 100
```

## Related Skills

- `epic-story-task` — EPIC / Story / Task の階層・運用方針
- `create-epic` — 新規 EPIC を作成する対話フロー
- `decompose-epic` — EPIC を全体リリース Story / 機能別 検証 Story に分解する対話フロー
- `plan-dependencies` — blocked-by 関係を設計する対話フロー
- `review-progress` — EPIC の進捗を棚卸しする対話フロー
