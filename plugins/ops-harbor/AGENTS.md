# ops-harbor

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Ops Harbor 連携 — キャッシュされた作業項目の可視化と MCP ファーストワークフロー。

## 設計

- skill `use-ops-harbor` は呼び出し制御のフィールドを持たない。Ops Harbor MCP が使える環境で CI やレビューの状況を自然文で聞かれたとき、Claude がキャッシュを確認するための手順で、読み取り専用
- plugin は `.mcp.json` を同梱しない。MCP ツール名は、ユーザーが `ops-harbor` という名前で登録している前提で完全修飾名（`mcp__ops-harbor__ops_harbor_*`）で書く。ツール名の正本は `apps/ops-harbor/src/mcp-server.ts`

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `use-ops-harbor`: ローカルの Ops Harbor がキャッシュしている作業項目を Ops Harbor MCP（`mcp__ops-harbor__*`）で確認する。作業項目は PR の CI 失敗、レビュー、マージコンフリクト、base との乖離である。Ops Harbor MCP が使える環境で、「CI が落ちている PR を教えて」「いま対応が必要な作業を見せて」のように作業項目の状況を聞かれたときに使う。

<!-- END:component-list -->
