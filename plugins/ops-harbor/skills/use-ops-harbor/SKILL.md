---
name: use-ops-harbor
description: ローカルの Ops Harbor がキャッシュしている作業項目を Ops Harbor MCP（`mcp__ops-harbor__*`）で確認する。作業項目は PR の CI 失敗、レビュー、マージコンフリクト、base との乖離である。Ops Harbor MCP が使える環境で、「CI が落ちている PR を教えて」「いま対応が必要な作業を見せて」のように作業項目の状況を聞かれたときに使う。
---

# use-ops-harbor

Ops Harbor のローカルアプリと MCP サーバーはユーザーが起動・登録しておく。以下は MCP サーバーを `ops-harbor` という名前で登録している前提のツール名。別名で登録されている場合は `mcp__<登録名>__...` に読み替える。ツールが見つからなければ、Ops Harbor が起動・登録されていない旨をユーザーに伝える。

## 手順

1. `mcp__ops-harbor__ops_harbor_list_alerts` で、対応が必要な項目（CI 失敗・コンフリクトなど）を確認する
2. `mcp__ops-harbor__ops_harbor_list_work_items` で対象を絞る。引数 `state` / `repository` / `has_blocker` で絞り込める
3. `mcp__ops-harbor__ops_harbor_get_work_item`（引数 `id`）で、チェック・レビュー・マージ状態の詳細を見る
4. 次の行動を提案する前に、`mcp__ops-harbor__ops_harbor_list_activity`（引数 `work_item_id` か `repository`、`limit`）で最近の経緯を確認する

Ops Harbor MCP は読み取り専用。キャッシュの内容は最新とは限らないので、push やマージの判断の直前には `gh` で現在の状態を確かめる。
