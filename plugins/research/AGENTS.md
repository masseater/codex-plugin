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

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `research:image-analyze`
- `research:incremental-research`
- `research:library-research`
- `research:semtools`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                          | Description                                                                                                                                                                                                           |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | research:image-analyze        | This skill should be used when the user asks to "analyze image", "compare screenshots", "visual diff", "PDFを解析", or wants image/PDF analysis using AI or local processing.                                         |
| skill | research:incremental-research | This skill should be used when the user asks to "research incrementally", "調査計画を作って進める", "multi-step investigation", "調査結果を記録", or wants structured research tracked in a markdown plan.            |
| skill | research:library-research     | This skill should be used when the user asks to "research this library", "ライブラリを徹底調査", "framework investigation", "knowledge base", or wants clone-first hands-on research persisted as reusable knowledge. |
| skill | research:semtools             | This skill should be used when the user asks to "semantic search", "自然言語で検索", "semtools", "search files by meaning", or wants to search file contents using natural-language queries.                          |

<!-- END:component-list -->
