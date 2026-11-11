# Issue body テンプレート

EPIC / Story の body には目的だけを書く。実装方法・設計詳細・コード・子 Issue のリンク一覧は書かない（依存関係は sub-issue と blocked-by で持つ）。Issue のタイトルと本文は英語で書くので、テンプレートも英語にしている。

## EPIC

```markdown
## Goal

<The state this EPIC should achieve, in 1-3 lines>

## Desired outcome

- <What becomes possible for users / stakeholders>

## Success criteria

- <A measurable indicator, e.g. login failure rate drops from 5% to 1%. If none, the condition for judging success>

## Target users / stakeholders

- <Who benefits>
```

## 全体リリース Story

```markdown
## Goal

<The completed state in which the whole EPIC is released>

## Desired outcome

- <What is true at release>
```

## 機能別 検証 Story

```markdown
## What to verify (feature: <feature name>)

Verify that the released "<feature name>" works as intended.

## Checkpoints

- <Concrete, observable checks, e.g. the login screen shows "Email", "Google", and "Apple" in this order>

## If something differs

Fix the gap. If there is no gap, no fix is needed.

## Verification log (comment even before completion)

Comment on this Story each time you verify something, even if verification is not finished. Record the steps you took and the evidence for judging it as intended or different (screenshots, logs, device checks, in a form a third party can re-check). When verification is done, do not close this Story; set its status to Need Review.
```

## 悪い例

実装方法と子 Story のリンクを body に書いている。

```markdown
## Implementation

- Create `LoginButtons.tsx` and render the buttons with `providers.map()`

## Child stories

- #12 Implement login buttons
```
