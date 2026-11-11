# ui-dev

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Figma のデザインから UI を実装するワークフロー（デザインデータ取得 → 実装 → レビュー → 修正）を提供する。

## 開発コマンド

```bash
cd plugins/ui-dev
vp run check && vp run typecheck && vp run test
```

## 前提とする plugin

- Anthropic 公式 Figma plugin（Figma MCP と `figma:implement-design`）。1 画面の実装は公式の implement-design、プロトタイプをたどるフロー全体の実装は `figma-implement` が受け持つ
- Vercel agent-browser plugin（実装画面のスクリーンショット）

## 構成の要点

- 成果物（config.json、screen map、prototype-chain.json、reports）は利用者のプロジェクトの `.agents/ui-dev/<flowName>/` に置く。config.json の形式は `figma-implement` の SKILL.md と `lib/config.ts` のスキーマが正本
- Figma REST API のスクリプトは `skills/figma-data/scripts/` に集約する。Figma MCP の `get_design_context`（公式 Figma plugin 経由では `mcp__plugin_figma_figma__get_design_context`）は近似値なので、正確な値はスクリプトで取る
- `redirect-figma-screenshot` は `hooks/hooks.json` の PreToolUse でグローバルに登録する。`get_screenshot` を `permissionDecision: "deny"` で拒否し、`export-screenshot.ts` の絶対パスを案内する。`figma-implement` を使わないセッションや公式 implement-design の実行中も含めて全セッションで拒否する。Figma のスクリーンショットを常にファイルに残し、画像比較で再利用できるようにするためである。skill の frontmatter には重ねて登録しない（skill 起動後に 2 回発火するため）
- `notify-phase-status` は `figma-implement` の frontmatter の Stop hook で、ユーザー向けの再開案内を `systemMessage` で出す
- エージェント（figma-implementer / visual-reviewer / code-reviewer）は `figma-implement` からだけ起動する。親との通信はレポートファイルで行い、レビュアーは絞り込まずに全件を severity と confidence 付きで出す

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `figma-data`: Figma REST API から、実装で使う正確な値（色・余白・角丸・影・タイポグラフィ）とコンポーネントの variant を取得する。プロトタイプの遷移とアニメーション、SVG/PNG アセット、ノードのスクリーンショットも取得する。Figma MCP の get_design_context の近似値では足りないときと、Figma のスクリーンショットをファイルへ保存したいときに使う。
- **skill** `figma-implement`: Figma のプロトタイプをたどって画面一覧と遷移を洗い出し、画面ごとに実装・ビジュアルレビュー・仕様レビュー・修正をサブエージェントで回してフロー全体を実装する。Figma のプロトタイプ URL を渡されて「このフローを実装して」「Figma の画面を全部実装して」と頼まれたときに使う。1 画面だけなら公式 Figma plugin の implement-design で足りる。
- **agent** `code-reviewer`: figma-implement skill から起動され、UI の実装コードを screen map と突き合わせて、遷移・状態・バリデーションの過不足を事実として列挙する。
- **agent** `figma-implementer`: figma-implement skill から起動される。Figma のデザインと screen map をもとに UI の 1 画面を実装するか、レビュー指摘を修正し、結果をレポートファイルに書く。
- **agent** `visual-reviewer`: figma-implement skill から起動され、Figma のスクリーンショットと実装画面のスクリーンショットを比べて、見た目の差分を事実として列挙する。
- **hook** `install-deps`: SessionStart
- **hook** `redirect-figma-screenshot`: PreToolUse (`mcp__.*figma.*__get_screenshot`)

<!-- END:component-list -->
