---
name: gh-projects:decompose-epic
description: EPIC を「全体リリース Story」と「機能別 検証 Story」に分解し、sub-issue でリンク・blocked-by を張って Project に追加するワークフロー。Use when the user asks to "break down an EPIC", "decompose into stories", "EPIC を分解", "Story に切り分けたい", or has an EPIC that needs decomposition.
---

# Decompose EPIC

EPIC を「全体リリース Story（1つ）」と「機能別 検証 Story（機能ごと）」に分解し、sub-issue でリンク、blocked-by を張って Project に追加する。`epic-story-task` skill の方針（段階的分割をしない / 2種の Story / body は目的のみ / 依存は Issue 関係が SSoT）に従う。

## 分解の方針

EPIC 分解時点で、子 Story を次の2種だけ起票する:

- 全体リリース Story（1つ） — EPIC の全体を一度に作り切ってリリースする
- 機能別 検証 Story（機能ごと） — リリース後、機能ごとに意図どおり実装されているかを確認する

段階的フェーズや「機能 A を先に / 機能 B を後で」の積み上げ分割はしない。作業時間・規模でも割らない。Task は全体リリース Story の任意の作業分解であり、必須ではない。

## Inputs to gather

`AskUserQuestion` で一括で聞く:

1. EPIC 番号 — `<owner>/<repo>` と `<epic#>`
2. 対象機能のリスト — 検証 Story を機能ごとに切るため、EPIC が対象とする機能を列挙
3. 対象 Project — 親 EPIC と同じ Project に入れることが多い

## Workflow

### Step 1: Read parent EPIC

```bash
gh issue view <epic#> -R <owner>/<repo> --json title,body,number
```

EPIC の目的と対象機能を把握する。既に sub-issue がある場合は重複起票を避ける:

```bash
../../scripts/gh-project.ts sub-issue:list <owner>/<repo> <epic#>
```

### Step 2: Draft children

- 全体リリース Story を1つ ドラフト（タイトルは成果視点）
- 機能ごとに 検証 Story を1つずつ ドラフト

body は目的だけを書く（実装方法・コード・子リンクは書かない → `epic-story-task` skill「Issue body の書き方」）。

#### 全体リリース Story 本文テンプレ

```markdown
## 目的

<EPIC の全体をどの完成状態でリリースするか>

## 達成したい状態

- <リリース時に実現していること>
```

#### 機能別 検証 Story 本文テンプレ

```markdown
## 確認したいこと（機能: <機能名>）

リリースした「<機能名>」が意図どおり実装されているかを確認する。

## 確認観点

- <具体的な確認項目>

## 相違があった場合

ズレを修正する。ズレが無ければ修正は不要。

## 確認の記録（完了前でもコメントする）

確認した内容は、完了していなくても都度この Story にコメントで残す。実施した確認手順と根拠（スクリーンショット / ログ / 実機確認など）を書く。確認が一通り済んだら close せず status を Need Review に設定する。
```

### Step 3: Confirm with user

`AskUserQuestion` で提案（全体リリース Story + 検証 Story のタイトル一覧）を確認:

- 承認 / タイトル修正 / 一部除外 / やり直し

番号で列挙して「1, 3, 4 だけ採用」のように答えられるようにする。

### Step 4: Create children sequentially

ループで各子を作成（並列にすると issue 番号順が崩れて読みづらい）:

```bash
gh issue create -R <owner>/<repo> \
  --title "<title>" \
  --body-file <tmpfile> \
  [--type STORY | --label type:story]
```

`--body-file` を使い、本文は一時ファイルに書く（コマンドラインへのエスケープ事故を避ける）。返ってきた URL から番号を抽出して `<child#>` とする。

### Step 5: Link as sub-issue

```bash
../../scripts/gh-project.ts sub-issue:add <owner>/<repo> <epic#> <child#>
```

### Step 6: Add to Project

```bash
../../scripts/gh-project.ts item:add <owner> <project#> <child-url>
```

### Step 7: Set dependencies

各 検証 Story を全体リリース Story の blocked-by にする（リリース後に確認するため）:

```bash
../../scripts/gh-project.ts block:add <owner>/<repo> <検証Story#> <全体リリースStory#>
```

### Step 8: Verify

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <epic#>
```

- sub-issue 件数が増えているか
- 各 検証 Story が全体リリース Story に blocked-by されているか
- 全て Project に入っているか

## 依存関係の SSoT

親子は sub-issue、前後関係は blocked-by で表現する。**親 body に子 Story のリンクを列挙しない**（二重管理になり Issue 操作と乖離する）。

## Output Contract

```json
{
  "epic": 100,
  "releaseStory": { "number": 101, "title": "..." },
  "verificationStories": [{ "number": 102, "title": "...", "feature": "..." }],
  "linkedAsSubIssues": true,
  "addedToProject": true,
  "blockedByRelease": true,
  "nextStep": "Run plan-dependencies if there are extra ordering constraints"
}
```

## Notes

- 子は「全体リリース Story（1つ）＋機能別 検証 Story」だけ。段階的な実装 Story を増やさない
- 子 Issue を作った後で親に紐付けを忘れる失敗が多い。Step 5 を必ず実行する
- Task は全体リリース Story の任意の作業分解。必要なときだけ、別途 sub-issue として足す
