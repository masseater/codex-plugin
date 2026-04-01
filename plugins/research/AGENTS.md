# research プラグイン開発ガイド

調査・分析ツールを提供する Claude Code プラグイン。

## 開発コマンド

```bash
cd plugins/research

bun run check        # lint + format チェック
bun run check:fix    # 自動修正
bun run typecheck    # 型チェック
```

## Hooks 実装

hooks/ ディレクトリ内の TypeScript ファイルで実装。cc-hooks-ts を使用。

## ファイル参照ルール

- hooks.json 内: `./hooks/xxx.ts`
- スキル内: `@./skills/xxx/reference.md`

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                          | Description                                                                                                                                                                                                                              |
| ----- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | research:image-analyze        | Analyze or compare images and PDFs using AI (Gemini) or local processing (sharp/pixelmatch). Use when performing design review, screenshot comparison, visual diff, edge detection, image metadata inspection, or PDF document analysis. |
| skill | research:incremental-research | 調査計画をmarkdownに記載し、順次調べて結果を記録する構造化された調査ワークフロー                                                                                                                                                         |
| skill | research:library-research     | ライブラリ・フレームワーク・ツールの徹底調査と知識ベース永続化                                                                                                                                                                           |
| skill | research:semtools             | 自然言語でファイルの中身を検索するsemtoolsの使用ガイド。Use when performing semantic search across files using natural language queries.                                                                                                 |

<!-- END:component-list -->
