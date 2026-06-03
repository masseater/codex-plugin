# gh-projects Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
GitHub Projects を **EPIC - Story - Task** の3階層と依存関係（sub-issue / blocked-by）で運用するためのプラグイン。

## Overview

このプラグインは「方法論 skill」と「CLI スクリプト」の2層構成。

- **skills/** — EPIC / Story / Task 階層、依存関係、進捗管理の汎用パターンを説明する
- **scripts/gh-project.ts** — `gh` CLI + GraphQL を薄くラップしたコマンド集（Project CRUD、sub-issue、blocked-by など）

skill は scripts/gh-project.ts を `./scripts/gh-project.ts` で参照する。

## Development Commands

```bash
cd plugins/gh-projects

bun run check        # lint
bun run check:fix    # auto-fix
bun run typecheck    # type check
```

## Prerequisite

`scripts/gh-project.ts` を使うには `gh` CLI と `project` スコープが必要:

```bash
gh auth refresh -s project
```

## Design Principles

- **リポジトリ非依存**: 特定の Project 番号 / Field 名 / Issue 内容を skill に書かない。サンプルは `<owner>/<repo>` プレースホルダで示す
- **GitHub 標準機能のみ**: Sub-issue / Issue Dependencies / Projects (v2) を使う。サードパーティ拡張に依存しない
- **方法論と道具の分離**: skill は「何をどう判断するか」、CLI は「どう実行するか」を担当する

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                          | Description                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | gh-projects:cli               | GitHub Projects CLI コマンドリファレンス。gh-project.ts スクリプトで Project CRUD、sub-issue、blocked-by などを操作する。Use when the user asks to "run a gh-project command", "list project items", "add a sub-issue", "set blocked-by", "show issue dependencies", "プロジェクトに追加", "sub-issue を作成", "依存関係を設定", or wants to invoke the gh-projects CLI directly. |
| skill | gh-projects:create-epic       | 新しい EPIC issue を起票し、GitHub Project に登録するワークフロー。Use when the user asks to "create an EPIC", "start a new EPIC", "EPIC を作成", "新しい EPIC を起票", "プロジェクトに EPIC を立てたい", or wants to bootstrap a top-level initiative.                                                                                                                           |
| skill | gh-projects:decompose-epic    | EPIC を「全体リリース Story」と「機能別 検証 Story」に分解し、sub-issue でリンク・blocked-by を張って Project に追加するワークフロー。Use when the user asks to "break down an EPIC", "decompose into stories", "EPIC を分解", "Story に切り分けたい", or has an EPIC that needs decomposition.                                                                                   |
| skill | gh-projects:epic-story-task   | EPIC - Story - Task の3階層と依存関係で GitHub Projects を運用するための方法論。Use when the user asks to "set up EPIC story task workflow", "design issue hierarchy", "configure project for EPIC story task", "EPIC Story Task で運用したい", "issue 階層を設計", "GitHub Project を立ち上げ", or wants conceptual guidance on this issue-management pattern.                   |
| skill | gh-projects:plan-dependencies | Story / Task 間の blocked-by 依存関係を設計・登録するワークフロー。Use when the user asks to "set blocked-by", "add dependency", "issue の前後関係を設定", "依存関係を整理", "blocking 関係", or wants to model ordering constraints between issues.                                                                                                                              |
| skill | gh-projects:review-progress   | EPIC 単位で sub-issue / blocked-by / Project status を棚卸しし、進捗・滞留・次に着手すべき Task をレポートするワークフロー。Use when the user asks to "review progress", "EPIC の進捗を確認", "棚卸し", "what's next", "次に何をやる", "blockers を確認", or wants a status snapshot of an EPIC.                                                                                  |

<!-- END:component-list -->
