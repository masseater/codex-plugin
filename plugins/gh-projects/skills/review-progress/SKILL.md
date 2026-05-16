---
name: review-progress
description: EPIC 単位で sub-issue / blocked-by / Project status を棚卸しし、進捗・滞留・次に着手すべき Task をレポートするワークフロー。Use when the user asks to "review progress", "EPIC の進捗を確認", "棚卸し", "what's next", "次に何をやる", "blockers を確認", or wants a status snapshot of an EPIC.
---

# Review EPIC Progress

EPIC 1つを起点に、配下の Story / Task / 依存関係 / Project Status を集計し、現状と次アクションを提示する。

## Inputs to gather

1. **EPIC 番号** — `<owner>/<repo>` と `<epic#>`
2. （任意）**対象 Project** — Status / Iteration を見る場合

## Workflow

### Step 1: Snapshot the EPIC

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <epic#>
```

得られる情報:

- 子 Story と完了率（`subIssuesSummary`）
- 横方向の依存（blocked-by / blocking）
- tracked-in / tracking

### Step 2: Expand to Stories

各 Story について再帰的に集計:

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <story#>
```

Task の open/closed と blocked-by を収集する。

### Step 3: Cross-reference with Project

Project Status を見たい場合:

```bash
../../scripts/gh-project.ts item:list <owner> <project#>
```

Issue 番号で突き合わせて Status / Iteration を付与する（CLI 出力をパースする）。

### Step 4: Categorize

各 open Issue を以下のバケットに分類:

| Bucket          | 条件                                | 意味       |
| --------------- | ----------------------------------- | ---------- |
| **Ready**       | open かつ blocked-by が全て closed  | 即着手可能 |
| **Blocked**     | open かつ blocked-by に open がある | 解除待ち   |
| **In Progress** | Project Status = In Progress        | 進行中     |
| **Stale**       | In Progress のまま更新が長期間ない  | 滞留疑い   |
| **Done**        | closed                              | 完了       |

"長期間" は文脈依存。デフォルトは2週間。

### Step 5: Build report

ユーザーに以下を返す:

```markdown
## EPIC #<n>: <title>

完了率: <closed>/<total> Story (<percent>%)

### Ready to start (X)

- #<n> <title> — assignee: <user|->

### In Progress (X)

- #<n> <title> — assignee: <user|->, status updated <days> ago

### Blocked (X)

- #<n> <title> — blocked by #<m> (<m-title>, status: <status>)

### Stale ⚠️ (X)

- #<n> <title> — no update for <days> days

### Done (X)

- #<n> <title>

## Recommendations

1. <次に着手を勧めるもの>
2. <ブロッカー解除のための提案>
3. <停滞中の Issue への対応案>
```

### Step 6: Optional actions

ユーザーが望めば:

- Stale 検出した Issue の assignee に確認コメント案を提示（コメント投稿は別途承認）
- Ready バケットの上位3件を次スプリントの候補として提案
- Blocking チェーンの再評価を `plan-dependencies` skill で提案

**自動でコメント・assignee 変更・Status 変更を行わない**。提案までに留め、実行はユーザー承認後に明示的に行う。

## Output Contract

```json
{
  "epic": 100,
  "summary": {
    "totalStories": 8,
    "doneStories": 3,
    "percentComplete": 38
  },
  "buckets": {
    "ready": [...],
    "inProgress": [...],
    "blocked": [...],
    "stale": [...],
    "done": [...]
  },
  "recommendations": ["..."],
  "nextStep": "Approve and run plan-dependencies to fix blocker chain"
}
```

## Heuristics

- 完了率 < 25% で停滞が多い → EPIC の Scope が広すぎる兆候。`decompose-epic` で分割を検討
- Blocked が Ready より多い → 依存設計の見直しが必要。`plan-dependencies` で graph を再評価
- Stale が3件以上 → assignee / 優先度のリバランスを提案
- Done が増えているが完了率が動かない → 子 issue が後から追加されている可能性。Scope の固定が必要

## Notes

- 棚卸しは **読み取り専用**。Status を勝手に変更しない
- 長い EPIC では subIssues が 50件以上になり API ページネーションが必要。本プラグインの CLI は `first: 50` 固定なので、それを超える場合は `gh api graphql` を直接叩く運用に切り替える
