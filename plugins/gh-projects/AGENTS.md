# gh-projects Plugin Development Guide

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。

## Overview

GitHub Projects を EPIC - Story - Task の 3 階層と依存関係（sub-issue / blocked-by）で運用する。方法論は `epic-story-task`、起票から依存登録までは `epic-plan`、棚卸しは `epic-review`、単発の CLI 操作は `cli`。CLI 本体は `scripts/gh-project.ts`（`gh` と GraphQL の薄いラッパー）で、`project` スコープが必要（`gh auth refresh -s project`）。

## Development Commands

```bash
cd plugins/gh-projects

vp run check         # fmt・lint・型検査（vp check）
vp run typecheck     # type check
```

## 設計判断

- skill に特定の Project 番号・Field 名・Issue 内容を書かない。例は `<owner>/<repo>` のプレースホルダで示す
- GitHub 標準機能（sub-issue、Issue Dependencies、Projects v2）だけを使う
- Issue body のテンプレートは `assets/issue-body-templates.md` に一本化し、skill からは `./assets/...` で参照する。複数箇所に置くと内容がずれるため
- 呼び出し制御: `epic-plan` と `cli` は Issue の起票・リンク・依存登録・Status 変更という GitHub 上に残る操作をする。実行タイミングをユーザーが決めるので `disable-model-invocation: true` にしている。`cli` の「落とし穴」は `epic-plan` と `epic-review` からファイルとして直接読ませる。`epic-story-task`（方法論）と `epic-review`（読み取り。Status の変更は承認を得てから）は model invocation を許可する
- Issue のタイトルと本文は英語で書く（github-workflow の `create-issue` と同じ方針）。テンプレートも英語にしている

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `cli`: gh-projects の CLI（gh-project.ts）で Projects v2 の item・Status、sub-issue、blocked-by を 1 件ずつ操作する。
- **skill** `epic-plan`: EPIC の起票から、全体リリース Story と機能別 検証 Story への分解、sub-issue 化、Project への追加、blocked-by の登録までを、各段で承認を取りながら行う。
- **skill** `epic-review`: EPIC 配下の Story / Task を sub-issue・blocked-by・Project の Status から棚卸しする。着手可能・ブロック中・滞留・Need Review に分類し、次のアクションを提案する。棚卸しは読み取りだけで行い、Status などの変更は承認を得てから別途実行する。「EPIC の進捗を確認して」「次に何をやるか教えて」「ブロッカーを確認して」と頼まれたときに使う。
- **skill** `epic-story-task`: GitHub Projects を EPIC - Story - Task の 3 階層と sub-issue / blocked-by の依存関係で運用する方法論。GitHub Issue / Projects で EPIC・Story・Task の階層を設計するとき、Story の分け方・Issue body の書き方・close の扱いを判断するときに使う。

<!-- END:component-list -->
