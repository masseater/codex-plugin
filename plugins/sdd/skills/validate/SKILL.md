---
name: validate
description: SDD の spec 文書（矛盾・ステアリング準拠・実現可能性）か、実装を終えた Phase（ドキュメント・要件・品質）を検証し、指摘を severity 付きで報告する。「仕様書をチェックして」「矛盾がないか見て」「Phase 2 の実装を検証して」「これで完了でいいか確認して」と頼まれたときに使う。
argument-hint: "<spec|phase> <spec 名> [Phase 番号]"
---

# SDD の検証

引数: `$ARGUMENTS`（先頭が `spec` か `phase`。省略されたら、Phase 番号があれば phase、なければ spec とみなす）

参照ファイルの `<skill-dir>` は `${CLAUDE_SKILL_DIR}`、`<plugin-root>` は `../..` に読み替える（参照ファイルでは変数が展開されないため）。

## spec モード: 仕様書を検証する

spec 文書を書き終えたときや、Phase 構成を決める前に使う。

1. 次の 2 つの agent を 1 つのメッセージで並列に起動する。どちらも修正はせず、指摘だけを返す
   - `sdd:contradiction-checker` — spec 文書間の矛盾（prompt に spec 名を渡す）
   - `sdd:steering-reviewer` — ステアリングへの準拠（prompt にレビュー対象として `specs/<spec>/` を渡す）
2. 待つ間に [references/feasibility.md](references/feasibility.md) に従い、technical-details.md と実際のプロジェクト構造の食い違いを自分で確かめる
3. 3 つの結果をまとめて報告する

## phase モード: 実装を終えた Phase を検証する

`/sdd:phase implement` で Phase の全タスクを終えたときに使う。次の 3 観点を順に確かめる。ある観点で問題が見つかっても、残りの観点も最後まで確かめる。

- ドキュメント: [references/docs.md](references/docs.md)
- 要件: [references/requirements.md](references/requirements.md)
- 品質: [references/quality.md](references/quality.md)

## 指摘の書き方と判定

- 指摘はすべて `[severity: high|medium|low] [confidence: high|medium|low] <ファイル:行>: <問題と根拠>` の形で列挙する。見つけたものは軽微でも省かない
  - high: 要件を満たさない、テストや型チェックが落ちる、文書の矛盾で実装が分岐する
  - medium: 規約・ステアリングからの逸脱、引き継ぎや完了条件の記載漏れ
  - low: 表記の揺れなど、動作や判断に影響しないもの
- 判定: severity が high の指摘があれば「不合格」、medium だけなら「要対応」、low だけか指摘なしなら「合格」
- 検証結果は spec 文書には書かず、ユーザーへの報告として返す
- 「要対応」以上なら、指摘ごとの対応方針（修正する / 仕様を見直す / 対応しない）を `AskUserQuestion` で聞く（1 回に最大 4 問）。修正すると決まったものはタスクリスト（TodoWrite、または TaskCreate / TaskUpdate）に積む
- phase モードで「合格」なら、phase ファイルの `status:` を `completed` にしてよいかを確認し、承認されたら書き換えて sdd-webapp に反映する（手順は `/sdd:phase` の「状態を変えたら」）。最後の Phase なら、overview.md の `status:` も `completed` にするかを確認する
