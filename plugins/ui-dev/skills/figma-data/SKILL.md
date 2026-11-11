---
name: figma-data
description: Figma REST API から、実装で使う正確な値（色・余白・角丸・影・タイポグラフィ）とコンポーネントの variant を取得する。プロトタイプの遷移とアニメーション、SVG/PNG アセット、ノードのスクリーンショットも取得する。Figma MCP の get_design_context の近似値では足りないときと、Figma のスクリーンショットをファイルへ保存したいときに使う。
---

# figma-data

スクリプトは `${CLAUDE_SKILL_DIR}/scripts/` にあり、shebang 付きなので直接実行する。すべて `FIGMA_ACCESS_TOKEN` 環境変数が必要。引数の詳細は各スクリプトの `--help` で確認する。

fileKey と nodeId は Figma の URL `https://www.figma.com/design/<fileKey>/...?node-id=<nodeId>` から取る。nodeId はコロン（`18067:11823`）とダッシュ（`18067-11823`）のどちらでも受け付けるが、`document: null` が返ったらもう一方の形式を試す。

## MCP とスクリプトの使い分け

以下は公式 Figma plugin（plugin 名 `figma`、MCP サーバー名 `figma`）経由のツール名。Figma MCP を plugin を使わず単体で `figma` として登録している場合は `mcp__figma__...` になる。

- 全体像と参考コード: `mcp__plugin_figma_figma__get_design_context`。値は近似なので、そのまま実装値にしない
- レイヤー構造の概観: `mcp__plugin_figma_figma__get_metadata`
- デザイントークン・変数: `mcp__plugin_figma_figma__get_variable_defs`
- スクリーンショット: `export-screenshot.ts`。`mcp__plugin_figma_figma__get_screenshot` は hook で拒否される
- 正確な CSS 相当の値: `extract-node-properties.ts`
- variant の props と組み合わせ: `get-component-variants.ts`
- アイコン・イラストの書き出し: `export-node-images.ts`
- 遷移・アニメーション・easing: `trace-prototype-chain.ts` と `query-prototype-chain.ts`
- ファイル内の全ページとフレーム: `list-file-frames.ts`
- 単一ノードの生レスポンス確認: `fetch-figma-node-response.ts`

## 今実装しているノードだけを取得する

データはノードごとに、使う時点で取得し、全ノードを先にまとめて取らない。取得した JSON はそのままコンテキストに載るので、使わないデータはトークンを浪費するだけになる。

## スクリプト

- `export-screenshot.ts`: ノードを画像で保存する。細部を比較するときは `--scale 2` にする

  ```text
  export-screenshot.ts --file-key <key> --node-id <id> --output <path> [--scale 1] [--format png|jpg|svg|pdf]
  ```

- `extract-node-properties.ts --file-key <key> --node-id <id> [--depth] [--output]`: 色・余白・角丸・影・フォントなどを CSS 相当の値で出す
- `get-component-variants.ts --file-key <key> --node-id <id> [--output]`: コンポーネントセットの variant を解析する
- `export-node-images.ts`: アセットを書き出す

  ```text
  export-node-images.ts --file-key <key> --node-ids <id,...> --output-dir <dir> [--format svg|png|jpg|pdf] [--scale 2]
  ```

- `list-file-frames.ts --file-key <key> [--output]`: 全ページとトップレベルのフレームを JSON で出す。トレースの開始ノードを探すときに使う
- `fetch-figma-node-response.ts --file-key <key> --node-id <id>`: 単一ノードの生の API レスポンスを JSON で出す。`document: null` の判定や、1 ノードの `interactions` の確認に使う

## プロトタイプの遷移

1. フローごとに 1 回だけトレースする。開始ノードから `interactions[].actions[].destinationId` を子ノードまで含めて BFS でたどり、見つかった全フレームの PNG を `<output のディレクトリ>/screenshots/` に保存する

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/trace-prototype-chain.ts --file-key <key> --node-id <id> --output <path.json>
   ```

   フレームが 1 つしか出ないときは、ページではなくフレームのノードを指定しているか確認する。訪問済みのフレームに戻った時点で探索は止まるので、途中で止まって見えても正常なことが多い

2. 実装中に特定ノードの遷移が必要になったら、その都度問い合わせる。`--node-id map` で全フレームのつながりを出せる。出力の Markdown をそのまま使い、グラフの JSON は直接読まない

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/query-prototype-chain.ts --json-path <path.json> --node-id <id|map>
   ```

1 つのボタンやアイコンの遷移を確かめるだけなら、トレースせずに `fetch-figma-node-response.ts` で足りる。
