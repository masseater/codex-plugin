---
name: decompose-epic
description: EPIC を Story に、Story を Task に分解して sub-issue でリンクし Project に追加するワークフロー。Use when the user asks to "break down an EPIC", "decompose into stories", "split into tasks", "EPIC を分解", "Story に切り分けたい", "Task に落としたい", or has an EPIC/Story that needs decomposition.
---

# Decompose EPIC / Story

EPIC → Story、Story → Task の分解と sub-issue リンクを行う。`epic-story-task` skill の階層定義と粒度判断に従う。

## Decision: which level am I decomposing?

最初に親 Issue のレベルを確認:

- 親が EPIC → 子は Story
- 親が Story → 子は Task

```bash
../../scripts/gh-project.ts sub-issue:list <owner>/<repo> <parent#>
```

既に sub-issue がある場合は重複分解を避ける。

## Inputs to gather

`AskUserQuestion` で一括で聞く:

1. **親 Issue 番号** — EPIC または Story
2. **目標粒度** — Story なら「ユーザー価値の単位」、Task なら「数時間〜数日」
3. **対象 Project** — 親と同じ Project に入れることが多い

## Workflow

### Step 1: Read parent

```bash
gh issue view <parent#> -R <owner>/<repo> --json title,body,number
```

本文から Goal / Scope / Sub-Stories セクションを抽出し、既に分解候補が列挙されているか確認。

### Step 2: Draft children

子 Issue の候補をドラフトする。1件あたり:

- タイトル（成果視点）
- 本文テンプレ（下記）
- 想定粒度（Story なら数日〜2週間 / Task なら数時間〜数日）

### Story 本文テンプレ

```markdown
## Parent EPIC

#<epic#>

## User-facing Outcome

<このStoryが完了したらユーザー / 関係者にとって何が変わるか>

## Acceptance Criteria

- [ ] <検証可能な条件>
- [ ] ...

## Sub-Tasks

<起票後に sub-issue として追加される Task の予定。決まっていなければ空>

## Dependencies

- Blocked by: <他Storyがあれば>
- Blocking: <他Storyがあれば>
```

### Task 本文テンプレ

```markdown
## Parent Story

#<story#>

## What to do

<実装内容を1〜3行で>

## Definition of Done

- [ ] 実装完了
- [ ] テスト追加
- [ ] レビュー完了

## Dependencies

- Blocked by: <他Task / Storyがあれば>
```

### Step 3: Confirm with user

`AskUserQuestion` で:

- 提案された分解（タイトルリスト）を承認するか
- タイトルだけ修正
- 一部を除外
- やり直し

複数の子をまとめて確認するときは番号で列挙してユーザーが「1, 3, 4 だけ採用」のように答えられるようにする。

### Step 4: Create children sequentially

ループで各子を作成（並列にすると issue 番号順が崩れて読みづらい）:

```bash
# Story 起票
gh issue create -R <owner>/<repo> \
  --title "<title>" \
  --body-file <tmpfile> \
  [--type STORY | --label type:story]
```

返ってきた URL から番号を抽出して `<child#>` とする。

### Step 5: Link as sub-issue

```bash
../../scripts/gh-project.ts sub-issue:add <owner>/<repo> <parent#> <child#>
```

### Step 6: Add to Project

```bash
../../scripts/gh-project.ts item:add <owner> <project#> <child-url>
```

### Step 7: Update parent body

親 Issue の `## Sub-Stories` / `## Sub-Tasks` セクションを更新（chain of `- #<child#> <title>` を埋め込む）:

```bash
gh issue edit <parent#> -R <owner>/<repo> --body-file <updated-body>
```

これにより親 Issue を読むだけで子の一覧が見える（sub-issue UI と二重管理になるが、長期的には親 body が壊れない方が便利）。

### Step 8: Verify

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <parent#>
```

- sub-issue 件数が増えているか
- 全て Project に入っているか

## Quality checks

- 子が **5件超** になったら、もう一段階階層を増やすことを検討（中間 Story / Task グループ）
- 子の粒度が **EPIC レベル** に見えたら、その子は EPIC として独立させて parent からは外す
- 同じ系統で並列に進められる子が大半なら sub-issue でリンクすれば十分。順序が必要なら `plan-dependencies` に進む

## Output Contract

```json
{
  "parent": 100,
  "children": [
    { "number": 101, "title": "...", "level": "Story" },
    { "number": 102, "title": "...", "level": "Story" }
  ],
  "linkedAsSubIssues": true,
  "addedToProject": true,
  "nextStep": "Run plan-dependencies if children have ordering constraints"
}
```

## Notes

- 分解は **1段ずつ**。EPIC からいきなり Task まで降ろさない（中間の Story が欠落して見通しが悪くなる）
- 親 body と sub-issue UI が乖離するのを防ぐため、Step 7 を省略しない
- 子 Issue を作った後で親に紐付けを忘れる失敗が多い。Step 5 を必ず実行する
