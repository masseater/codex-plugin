---
name: define
description: 計画ファイル（User Prompts / Purpose / Approach / Branch / Structure / TODO / Verification）を規定の構成と記述規約で書く。「計画を立てて」「plan を作って」と頼まれたとき、Plan mode で計画を作るとき、Issue 番号や URL から実装計画を作るときに使う。
argument-hint: "[依頼内容 | Issue 番号 | Issue URL]"
---

# 計画ファイルを書く

## 置き場所

計画ファイルは `.local-agents/plans/<YYYYMMDD-HHmmss>-<rand>.md` に書く。Plan mode 中は計画ファイル以外を編集できないので、Plan mode が指定する計画ファイルに同じ構成で書く。

## 入力

- 依頼文: そのまま User Prompts に引用する
- Issue 番号または URL: `gh issue view <番号|URL> --json number,title,body,url,comments` で本文とコメントを読み、Purpose と TODO の根拠にする。User Prompts にはユーザーの依頼文を引用し、Issue は Purpose に URL で示す

## 構成

次の順で書く。

````markdown
## User Prompts

> <ユーザーの最初の依頼文を原文のまま>

> <計画中に受けた追加の依頼文。ExitPlanMode の承認時のフィードバックも含め、時系列で>

## Purpose

<この計画で達成すること。最終成果物（PR・ファイル・動作する機能など）を含める>

## Approach

- <使う手段>: <それを選んだ理由>

## Branch

- ブランチ: `<branch-name>`
- worktree: <既存の worktree を使うならそのパス。無ければ `gwq` で作る手順>

## Structure

### Before

```text
src/
  components/
    Button.tsx
    Modal.tsx
```

### After

```text
src/
  components/
    Button.tsx (delete)
    Modal.tsx
    Card.tsx (new)
```

## TODO

### 1. <タスク名>

- 対象ファイル: `path/to/file`
- 内容: <何をどう変えるか。ファイル単位の変更方針まで>

## Verification

1. <TODO 1 の確認方法（実行するコマンドと期待する結果）>
````

- User Prompts は要約・言い換えをせず原文のまま引用する。計画の意図を後から原文で確かめられるようにするため
- Structure には計画に関係するファイルだけをツリーで書き、新規は `(new)`、削除は `(delete)`、リネームは旧名 `(delete)` と新名 `(new)` で示す
- Approach と Branch は、ユーザーが方向性と作業場所の妥当性を計画だけで判断できるよう書く。ユーザーの個人ルール（`~/AGENTS.md` の計画節）が求める項目と同じ
- TODO の各項目には対象ファイルと変更方針を書き、承認後に行う作業だけを載せる。コード片や関数シグネチャのような API レベルの設計は書かない。計画のレビューを方向性の判断に集中させるため
- 調査や既存 worktree への移動は TODO に入れない。調査は計画を書く前に済ませ、worktree の作成が要るときだけ TODO の最初に置く
- Verification は TODO と対応させ、実行するコマンドや確認する挙動を具体的に書く

## 記述規約

計画ファイルは、会話を知らない読み手がこのファイルだけで実行できるように書く。詳細と例は [references/plan-file-content-rules.md](references/plan-file-content-rules.md) を読む。

- 最終的にやることだけを書く。改訂の経緯、レビューの指摘、却下した案は残さない
- 「上で議論したとおり」のような会話の文脈に依存する表現を使わない

## 計画中に追加の依頼を受けたら

User Prompts に時系列で追記し、TODO・Structure・Verification を最終形に更新する。古い記述は消し、改訂の痕跡を残さない。
