---
name: create-epic
description: 新しい EPIC issue を起票し、GitHub Project に登録するワークフロー。Use when the user asks to "create an EPIC", "start a new EPIC", "EPIC を作成", "新しい EPIC を起票", "プロジェクトに EPIC を立てたい", or wants to bootstrap a top-level initiative.
---

# Create EPIC

EPIC レベルの Issue を起票して GitHub Project に登録する。`epic-story-task` skill で定義した EPIC の役割（プロダクト目標、数週〜数ヶ月、ユーザー価値の単位）に従う。

## Inputs to gather

不明な情報は `AskUserQuestion` でまとめて聞く（一度に複数の質問可）:

1. **対象リポジトリ** — `<owner>/<repo>` 形式。指定が無ければ `gh repo view --json nameWithOwner -q .nameWithOwner` で現在の repo
2. **EPIC タイトル** — 成果視点で書く（実装視点は避ける）
3. **対象 Project** — `<owner>` と Project 番号。複数候補があれば `project:list` で取得して提示
4. **Type 表現** — Issue Types を使うか、ラベル（`type:epic`）で代用するか

## Drafting rules

タイトル:

- 成果視点（`Improve login experience` ✅ / `Implement login refactor` ❌）
- 1行・スコーププレフィックスは付けても良い（`[checkout] ...`）

本文テンプレ:

```markdown
## Goal

<このEPICで達成したい状態を1〜3行で>

## Success Metrics

- <定量的に測れる指標。例: 失敗率を 5% → 1% に>
- <なければ「成功と判定する条件」を箇条書き>

## Target Users / Stakeholders

- <誰にとっての価値か>

## Scope

- ✅ <含むもの>
- ❌ <含まないもの>

## Sub-Stories

<起票後に sub-issue として追加される予定の Story を箇条書き。決まっていなければ空でも良い>

## Open Questions

- <未確定の論点>
```

## Workflow

### Step 1: Resolve context

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

repo を確定。Project 番号がわからなければ:

```bash
../../scripts/gh-project.ts project:list <owner>
```

### Step 2: Draft and confirm

タイトル・本文をドラフトし、ユーザーに `AskUserQuestion` で確認:

- そのまま起票
- 修正してから起票
- キャンセル

**承認なしで自動 push しない**。

### Step 3: Create issue

Issue Types を使う場合:

```bash
gh issue create -R <owner>/<repo> \
  --title "<title>" \
  --body-file <tmpfile> \
  --type EPIC
```

ラベルで代用する場合:

```bash
gh issue create -R <owner>/<repo> \
  --title "<title>" \
  --body-file <tmpfile> \
  --label type:epic
```

`--body-file` を使い、本文は一時ファイルに書く（コマンドラインへのエスケープ事故を避ける）。

### Step 4: Add to Project

```bash
../../scripts/gh-project.ts item:add <owner> <project#> <issue-url>
```

### Step 5: Report

ユーザーに返す:

- Issue URL
- Issue 番号
- Project への追加結果
- 次に推奨するアクション（`decompose-epic` で Story を切る、など）

## Output Contract

```json
{
  "issueNumber": 100,
  "issueUrl": "https://github.com/<owner>/<repo>/issues/100",
  "title": "...",
  "projectAdded": true,
  "nextStep": "Run decompose-epic to break this EPIC into Stories"
}
```

## Notes

- EPIC をいきなり起票するのではなく、Goal と Scope のドラフト段階で確認を取る。EPIC は寿命が長く、後から軌道修正しづらい
- 起票直後は Status を `Todo` に置く。`In Progress` への遷移は最初の Story が動き出したタイミング
- 本文の `## Sub-Stories` セクションは空でも構わない。`decompose-epic` 実行時に更新する
