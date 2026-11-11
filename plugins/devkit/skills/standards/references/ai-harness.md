---
description: AI ハーネス設計 — hook によるフィードバックループ、quality-check log パターン、エージェント向けエラーメッセージの書き方
---

# AI ハーネス設計

AI コーディングエージェントに正しいコードを書かせる品質の担保は、プロンプトの指示ではなく hook・linter・test の仕組みで行う。

## hook によるフィードバックループ

品質の制約を hook でエージェントの実行サイクルに組み込む。各層は独立して働き、組み合わせると多層防御になる。

### PreToolUse: 実行前に止める

`.env` の直接編集や破壊的コマンドなど、実行してからでは取り返せない操作をブロックする。

### PostToolUse: 編集直後のフィードバック

ファイル編集後に linter と formatter を自動実行し、結果を `additionalContext` でエージェントのコンテキストに返す。stdout に書くだけではエージェントが確実に認識しないので、`hookSpecificOutput.additionalContext` を含む JSON で返す。

### Stop: 完了前の検証

エージェントが完了を宣言する前に test と型チェックを実行し、失敗を返して作業を続けさせる。

- フィードバックはそのセッションで変えた範囲に絞る。セッション開始時に基準値を取り、それとの差分だけを返す
- 各失敗は 1 回だけ報告する。既存の失敗を毎ターン報告し直すと、エージェントがタスク外の修正に引き込まれる。Claude Code も連続 8 回の継続でループを打ち切る
- hook が設計どおり動いているときは `decision: "block"` ではなく `hookSpecificOutput.additionalContext` を使う

#### quality-check log パターン

品質チェック（lint・typecheck・test など）を実行する Stop hook は、何が失敗したかをエージェントが特定できるよう、ジョブごとにログファイルを書く。

- ディレクトリ: `.claude/hooks/quality-check-log/`
- ファイル: `[jobname].log`。報告すべき内容があるときだけ書き、毎回その時点の全結果で上書きする。エージェントが開くファイルを、古い実行の結果のまま残さないため
- 各行にファイルパスと簡潔な失敗内容を書く
- エージェントに返す `additionalContext` は全出力ではなく、失敗したジョブとログパスの一覧にする。詳細はエージェントが個別のログを読んで得る

ジョブごとに分けるのは、修正中のジョブのログだけを読めば済み、修正ループの前後で差分を取りやすく、各出力が小さく保たれるため。

### 観測

全層で実行意図・結果・所要時間をログに残し、各 hook の発火回数とエージェントの修正ループ回数を可視化してハーネスの改善点を探す（`references/observability.md`）。

## エラーメッセージは修正指示として書く

linter や独自チェックのエラーメッセージは、AI エージェントが読む修正指示として設計する。違反の指摘だけでは足りず、次を含める。

- 何が違反か、ファイルと行番号
- WHY: そのルールがある理由（ADR や文書への参照）。理由が分かればエージェントは類似の違反も避けられる
- FIX: エージェントがそのまま実行できる粒度の修正手順

独自 lint rule（oxlint JS plugin / ESLint custom plugin）では、自動修正できるものは `--fix` を実装し、できないものは FIX に十分な情報を書く。

## AGENTS.md / CLAUDE.md

AGENTS.md・rules・skill・hook に何を置くかは、context plugin の `context-refactor` skill（`references/placement-criteria.md`）の基準に従う。AGENTS.md は 200 行未満に保ち、システムの状態を文章で説明する代わりにファイルへのポインタを書き、毎回必ず実行すべきことは hook か lint rule に移す。
