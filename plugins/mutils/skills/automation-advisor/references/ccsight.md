# ccsight データソースガイド

Claude Code の使用履歴を集計・検索する MCP サーバー。AI セッションの活動パターンを抽出するために使う。

## ツール一覧

見出しはツール名の末尾だけを書く。本文の冒頭に、MCP サーバーを `ccsight` の名前で登録している前提の完全修飾名を書く。

### stats

`mcp__ccsight__stats` は集計済みメトリクスを取得する。

- パラメータ: `period`（today / week / month / all）、`date_from` / `date_to`（YYYY-MM-DD）、`group_by`（day）
- 取得できるデータ:
  - プロジェクト別セッション数・コスト・トークン数
  - ツール使用ランキング（`top_tools`）— 繰り返し実行されているツールの特定に有用
  - MCP サーバー使用状況 — 設定されているが使われていない MCP（乖離型の候補）の発見に有用
  - 言語別ファイル操作数
  - 時間帯別アクティビティ

### sessions

`mcp__ccsight__sessions` はセッション一覧、またはセッション詳細を取得する。

- 一覧取得: `project`（部分一致）、`date_from` / `date_to`、`limit`、`sort`（date / cost / tokens）
- 詳細取得: `session_id`（先頭8文字）を指定
  - `conversation_limit` / `conversation_offset` で会話のページネーション
  - `conversation_query` で会話内検索（前後1メッセージのコンテキスト付き）
- 詳細で取得できるデータ:
  - `tool_usage` — セッション単位のツール使用回数。繰り返しパターンの定量化に有用
  - `files_touched` — セッションで触ったファイル一覧。頻繁に手動編集されるファイルの特定に有用
  - 会話内容 — 繰り返される判断・調査の特定に有用

### search

`mcp__ccsight__search` は全文検索をする。会話の中身をキーワードで検索し、スニペット付きで返す。

- パラメータ: `query`（必須）、`project`（部分一致）、`date_from` / `date_to`、`limit`
- 用途: 「毎回同じ調査をしている」パターンの検出。特定のコマンドやワークフローが複数セッションに跨って繰り返されているかの確認

### live_sessions

`mcp__ccsight__live_sessions` は現在稼働中のセッション一覧を返す。automation-advisor では通常使用しない。

## 活用パターン

```pseudocode
function extract_patterns_from_ccsight(project_path):
  // 1. 全体統計でホットスポットを特定
  stats = mcp__ccsight__stats(period="month")
  hot_tools = stats.top_tools  // 頻繁に使われるツール
  stale_mcp = stats.mcp_servers.filter(s => s.configured and s.total_calls == 0)

  // 2. プロジェクト絞り込みでセッション一覧取得（一覧は 1 回の呼び出し）
  sessions = mcp__ccsight__sessions(project=project_path, limit=50)

  // 3. 仮説に関係しそうなセッションだけ詳細を取る。件数の上限は SKILL.md の calibrate_exploration に従う
  for session in pick_relevant(sessions, hot_tools):
    detail = mcp__ccsight__sessions(session_id=session.id)
    // tool_usage の偏り、files_touched の頻度を分析

  // 4. 特定のキーワードで全文検索し、繰り返される調査を検出
  repeated = mcp__ccsight__search(query="<suspected pattern>", project=project_path)
```
