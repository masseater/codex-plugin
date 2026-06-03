# research プラグイン開発ガイド

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
調査・分析ツールを提供する Claude Code プラグイン。

## 開発コマンド

```bash
cd plugins/research

bun run check        # lint + format チェック
bun run check:fix    # 自動修正
bun run typecheck    # 型チェック
```

## Hooks 実装

- IF: Hook を実装する; THEN MUST: hooks/ ディレクトリ内の TypeScript ファイルに実装し、cc-hooks-ts を使用する

## ファイル参照ルール

- IF: hooks.json 内でファイルを参照する; THEN MUST: `./hooks/xxx.ts` 形式で書く
- IF: スキル内でファイルを参照する; THEN MUST: `@./skills/xxx/reference.md` 形式で書く

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                          | Description                                                                                                                                                                                                                                                           |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | research:image-analyze        | Analyze or compare images and PDFs using AI (Gemini) or local processing (sharp/pixelmatch). Use when performing design review, screenshot comparison, visual diff, edge detection, image metadata inspection, or PDF document analysis.                              |
| skill | research:incremental-research | 調査計画をmarkdownに記載し、順次調べて結果を記録する構造化された調査ワークフロー。Use when conducting and recording a multi-step investigation incrementally — planning research items, investigating them in order, and tracking status/findings in a markdown plan. |
| skill | research:library-research     | ライブラリ・フレームワーク・ツールの徹底調査と知識ベース永続化。Use when deeply researching a library/framework/tool (clone-first analysis, hands-on verification) and persisting the findings as a reusable knowledge base.                                          |
| skill | research:semtools             | 自然言語でファイルの中身を検索するsemtoolsの使用ガイド。Use when performing semantic search across files using natural language queries.                                                                                                                              |

<!-- END:component-list -->
