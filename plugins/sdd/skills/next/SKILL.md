---
name: sdd:next
description: 'This skill should be used when the user asks "what should I do next", "次に何をすればいい", "SDD next", "次のSDDステップ", or wants the next action inferred from the current specs state.'
argument-hint: "[spec]"
---

# next - 次ステップ提案

## 実行内容

タスクの現在状態を分析して次に実行すべきコマンドを提案する。

## 手順

1. タスク名が省略された場合、会話コンテキストから推測
2. `specs/{taskname}/` を確認
3. 各ファイルの存在と内容から状態を判定

## 状態判定ロジック

- タスク未作成 — overview.md なし
  - 提案コマンド: `/sdd:spec init`
- 調査未完了 — 調査項目に🔴がある
  - 提案コマンド: `/sdd:research conduct {taskname}`
- 要件未定義 — specification.md なし
  - 提案コマンド: `/sdd:spec requirements {taskname}`
- 技術未定義 — technical-details.md なし
  - 提案コマンド: `/sdd:spec technical {taskname}`
- Phase未計画 — Phase構成セクションなし
  - 提案コマンド: `/sdd:phase plan {taskname}`
- Phase詳細未作成 — tasks/phase\*.md なし
  - 提案コマンド: `/sdd:phase breakdown {taskname} N`
- 実装中 — タスクに未完了あり
  - 提案コマンド: `/sdd:phase implement {taskname} N.M`
- Phase検証待ち — 全タスク完了
  - 提案コマンド: `/sdd:validate {taskname} N`

## 出力例

```
## 次のステップ: auth-feature

現在の状態: Phase 2 実装中（タスク 2.3 完了）

**推奨コマンド:**
/sdd:phase implement auth-feature 2.4

**理由:**
Phase 2のタスク2.4「認証トークン検証」が未完了です。
```

## 関連コマンド

- `/sdd:status` - 全タスクのステータス確認
