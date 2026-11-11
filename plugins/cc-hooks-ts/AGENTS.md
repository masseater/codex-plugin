# cc-hooks-ts

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
TypeScript ライブラリ cc-hooks-ts で Claude Code の hook を書くためのリファレンスを提供するプラグイン。

## 設計

- skill `cc-hooks-ts` は呼び出し制御のフィールドを持たない。hook を書く作業中に Claude が参照するリファレンスで、ユーザーが名前で呼ぶこともある
- イベント一覧や出力フィールドの網羅はしない。公式 hooks リファレンスとライブラリの型定義が正本で、手書きの一覧はすぐ古くなるため

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `cc-hooks-ts`: TypeScript ライブラリ cc-hooks-ts（defineHook / runHook / context API）で Claude Code の hook を書くためのリファレンス。hook を新規作成・修正するとき、シェルスクリプトの hook を TypeScript に書き直すとき、cc-hooks-ts の型や応答の返し方を確認するときに使う。

<!-- END:component-list -->
