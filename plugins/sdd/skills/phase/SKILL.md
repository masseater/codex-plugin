---
name: phase
description: SDD の spec を Phase に分け、Phase ごとの詳細計画・実装・Phase の挿入・中断前の状態反映をする。「Phase 構成を決めて」「Phase 2 の計画を立てて」「Phase 1 を実装して」「Phase を追加して」「ここまでの進捗を反映して」と頼まれたときに使う。
argument-hint: "<plan|breakdown|implement|insert|sync> <spec 名> [Phase 番号 | Phase.タスク番号]"
---

# SDD Phase

引数: `$ARGUMENTS`

先頭のトークンで作業を選び、対応する参照ファイルを読んで進める。

参照ファイルの `<skill-dir>` は `${CLAUDE_SKILL_DIR}`、`<plugin-root>` は `../..` に読み替える（参照ファイルでは変数が展開されないため）。

- `plan <spec>` — Phase 構成を決めて overview.md に書く: [references/plan.md](references/plan.md)
- `breakdown <spec> <N>` — Phase N の詳細計画（phase ファイル）を作る: [references/breakdown.md](references/breakdown.md)
- `implement <spec> [N | N.M]` — phase ファイルのタスクを実装する: [references/implement.md](references/implement.md)
- `insert <spec> [位置]` — 未着手の Phase の前か末尾に Phase を挿入する: [references/insert.md](references/insert.md)
- `sync <spec> [N]` — 中断前に、実装の進み具合を phase ファイルへ反映する: [references/sync.md](references/sync.md)

## phase ファイル

- 置き場所は `specs/<spec>/phases/phase<N>-<name>.md`（`<name>` は英小文字とハイフン）。sdd-webapp もこの場所を読む
- テンプレートは `${CLAUDE_SKILL_DIR}/assets/phase-template.md`
- Phase の状態は frontmatter の `status:`（`not_started` / `in_progress` / `completed` / `rejected`）、タスクの状態は「タスク」節のチェックボックスが正。先頭の frontmatter に有効な status がない Write、status の行を消す Edit、未知の値にする Edit は hook が拒否する

## 状態を変えたら

phase ファイルの `status:` を書き換えたら、sdd-webapp のダッシュボードにも反映する。webapp はファイルの status ではなく自分のストアを読むため。

1. `mcp__plugin_sdd_sdd-webapp__sdd_webapp_list_projects` でこのリポジトリの `project_id` を得る。未登録なら `mcp__plugin_sdd_sdd-webapp__sdd_webapp_add_project` にリポジトリのルートの絶対パスを渡して登録する
2. `mcp__plugin_sdd_sdd-webapp__sdd_webapp_set_phase` に `project_id`・`spec_name`・`phase_number`・`name`・`status` を渡す

## 全作業に共通

- spec 文書は `../../assets/common-rules.md` に従って書く
- spec 名や Phase 番号を省略されたら、`../status/scripts/spec-state.ts specs` の出力から候補を出す。候補は `AskUserQuestion` で選んでもらう
- 作業が終わったら、更新したファイルと、`spec-state.ts specs <spec>` の `next` が示す次の作業を伝える
