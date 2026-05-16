---
name: plan-dependencies
description: Story / Task 間の blocked-by 依存関係を設計・登録するワークフロー。Use when the user asks to "set blocked-by", "add dependency", "issue の前後関係を設定", "依存関係を整理", "blocking 関係", or wants to model ordering constraints between issues.
---

# Plan Dependencies

兄弟関係にない Issue 同士の前後関係（blocked-by / blocking）を設計し、GraphQL で登録する。

`epic-story-task` skill の方針:

- **親子関係**: sub-issue で表現（EPIC ↔ Story、Story ↔ Task）
- **横方向の依存**: blocked-by で表現（並行進行が困難なもの、別系統で前提となるもの）

## When to add blocked-by

入れるべき:

- 同じ EPIC 内の Story B が、Story A の出力を前提とする
- Task が、別 Story の Task の完成を前提とする
- 別 repo / 別 EPIC の Issue に依存する場合（CLI も owner/repo を取れる）

入れない方が良い:

- 単に「順番に着手したい」だけ。並行可能なら blocked-by を付けない
- 親子で十分に表現できる範囲（sub-issue だけで足りる）
- リファクタリング先行のような暗黙の前提（書き手にしか見えない依存は別途設計タスクとして明示）

## Inputs to gather

`AskUserQuestion` でまとめて聞く:

1. **対象 EPIC または Story 番号** — どのスコープで依存を整理するか
2. **依存ペアのリスト** — `{ blocked: 102, blocking: 101, reason: "..." }` のような配列
3. ペアが未確定なら、まず Step 1 で構造を確認してから提案する

## Workflow

### Step 1: Inventory

スコープ内の全 sub-issue を取得:

```bash
../../scripts/gh-project.ts sub-issue:list <owner>/<repo> <epic#>
```

ネストして Story の sub-issue (Task) も見るときは、各 Story について `sub-issue:list` を回す。

### Step 2: Detect candidates

子 Issue の本文から「Blocked by」「depends on」「after #N」などの記述を抽出し、明示されている依存をリスト化する。

unstated dependencies（本文には書かれてないが構造上必要なもの）はユーザーに提案して確認を取る:

```
提案: #102 (Add API client) は #101 (Define API schema) に blocked-by すべき。
理由: API client は schema が決まらないと実装できない。
```

### Step 3: Confirm with user

`AskUserQuestion` で:

- 提案された依存ペアを承認
- 一部のみ採用
- 修正（blocked / blocking を入れ替える）
- やり直し

### Step 4: Detect cycles

承認されたペアと既存依存を合わせて DAG として閉路チェック:

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <issue#>
```

各 issue について blocked-by / blocking を取得し、循環があれば登録を止めてユーザーに報告。

簡易チェック手順（pseudo）:

```text
graph = {}
for issue in scope:
  graph[issue] = blockedBy(issue)
detect cycle via DFS
if cycle:
  abort and report
```

### Step 5: Register

各ペアを登録:

```bash
../../scripts/gh-project.ts block:add <owner>/<repo> <blocked#> <blocking#>
```

複数を順に処理。エラーが出たら（既存・自己参照など）スキップして続行し、最後にスキップリストを報告する。

### Step 6: Verify

EPIC 単位で再度棚卸し:

```bash
../../scripts/gh-project.ts deps:show <owner>/<repo> <epic#>
```

ユーザーに以下を返す:

- 登録した依存ペアリスト
- スキップしたペアと理由
- 検出された未登録の候補があれば提案

## Output Contract

```json
{
  "epic": 100,
  "addedDependencies": [
    { "blocked": 102, "blocking": 101 },
    { "blocked": 104, "blocking": 103 }
  ],
  "skipped": [{ "blocked": 105, "blocking": 105, "reason": "self-reference" }],
  "cyclesDetected": [],
  "nextStep": "Run review-progress to confirm the resulting graph"
}
```

## Common Pitfalls

- **過剰登録**: 「順番にやりたい」だけで blocked-by を付けると、実際の作業の柔軟性を失う。本当に並行不可能なものだけに絞る
- **逆向き登録**: `blocked` と `blocking` を混同しがち。CLI の引数順は `block:add <repo> <blocked#> <blocking#>` で、最初が「ブロックされる側」
- **循環見落とし**: A→B→C→A のような3点循環は手動で見つけにくい。Step 4 を省略しない
- **EPIC 間依存**: EPIC レベルでも blocked-by は付けられるが、EPIC 間の依存はロードマップ表現の方が読みやすいので Project の Iteration / Group で表現する方が良いことが多い

## Notes

- 1回のセッションで巨大な依存グラフを作ろうとしない。EPIC 1つずつ、Story 群を順に処理する
- 既存の依存を尊重する。`block:remove` は明示的に求められた時だけ実行する
