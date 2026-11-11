---
name: spec
description: SDD の仕様書（overview / specification / technical-details）を作り、調査項目の調査と「不明」箇所の確認で埋めていく。「仕様書を作りたい」「要件定義して」「技術設計を書いて」「調査項目を調べて」「不明点を確認して」と頼まれたときに使う。
argument-hint: "<init|research|requirements|technical|clarify> [spec 名] [引数]"
---

# SDD 仕様書

引数: `$ARGUMENTS`

先頭のトークンで作業を選び、対応する参照ファイルを読んで進める。トークンがなければ、`/sdd:status` と同じ判定（`../status/scripts/spec-state.ts specs <spec>`）の `next` に従う。

参照ファイルの `<skill-dir>` は `${CLAUDE_SKILL_DIR}`、`<plugin-root>` は `../..` に読み替える（参照ファイルでは変数が展開されないため）。

- `init <説明>` — spec ディレクトリと overview.md を作る: [references/init.md](references/init.md)
- `research <spec> [調査項目名]` — overview.md の調査項目を AI が調べて結論を出す: [references/research.md](references/research.md)
- `requirements <spec>` — specification.md（機能要件・非機能要件）を書く: [references/requirements.md](references/requirements.md)
- `technical <spec>` — technical-details.md（技術スタック・設計）を書く: [references/technical.md](references/technical.md)
- `clarify <spec>` — 「**不明**」箇所をユーザーに質問して確定させる: [references/clarify.md](references/clarify.md)

research と clarify の違い: research は AI が調べて決められる技術的な問い（ライブラリの比較、実現方法の検証）、clarify はユーザーの意思決定が要る問い（機能の範囲、業務ルール、UI の仕様）。

## 全作業に共通

- spec 文書は `../../assets/common-rules.md` に従って書く
- spec 名を省略されたら `specs/` 配下の候補から `AskUserQuestion` で選んでもらう（1 つだけならそれを使う）
- テンプレートは次のコマンドでコピーしてから中身を書く。既存ファイルは上書きされない

  ```bash
  ${CLAUDE_SKILL_DIR}/scripts/copy-templates.ts specs/<spec> <overview|specification|technical-details>
  ```

- 作業が終わったら、作った・更新したファイルと、`spec-state.ts` の `next` が示す次の作業を伝える
