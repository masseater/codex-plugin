# Claude / Codex セッションファイルガイド

ccsight を経由せず、セッションファイルを直接読む場合のガイド。ccsight がカバーしない情報（生の会話ログ、Codex セッション）を読む際に使う。

## Claude Code セッションファイル

### 場所

- セッション履歴: `~/.claude/projects/<escaped-project-path>/<session-id>.jsonl`
  - プロジェクトパスは英数字以外の文字（`/` や `.` など）が `-` に置換される（例: `/Users/pc386/ghq/github.com/org/repo` → `-Users-pc386-ghq-github-com-org-repo`）。一致するディレクトリが無ければ `ls ~/.claude/projects/` で実際の名前を確かめる
- グローバル履歴: `~/.claude/history.jsonl`
- 稼働中セッション: `~/.claude/sessions/<pid>.json`

### JSONL の構造

各行が JSON オブジェクト。主要なフィールド:

- `type` — 行の種別（`user`, `assistant`, `system`, `attachment` など）。`tool_use` / `tool_result` はトップレベルの `type` ではなく、`assistant` / `user` 行の `message.content[]` に入るブロックの `type`
- `message` — メッセージ内容
- `timestamp` — タイムスタンプ

### 活用パターン

```pseudocode
function scan_claude_sessions(project_path):
  escaped = project_path.replace(/[^A-Za-z0-9]/g, "-")
  session_dir = "~/.claude/projects/{escaped}/"

  for jsonl_file in glob(session_dir + "*.jsonl"):
    // assistant 行の message.content[] から type == "tool_use" のブロックを集計
    // 繰り返されるコマンドパターンを抽出
    // 繰り返される質問・調査パターンを抽出
```

## Codex セッションファイル

### 場所

- セッションインデックス: `~/.codex/session_index.jsonl`
- アーカイブ済みセッション: `~/.codex/archived_sessions/*.jsonl`
  - ファイル名形式: `rollout-<timestamp>-<session-id>.jsonl`

### 活用パターン

Codex セッションは Claude Code とは別のワークフローで実行されるため、Codex 経由で繰り返されているパターンを補完的に確認できる。

## ccsight との使い分け

- 集計・検索 → ccsight を優先（インデックス済みで高速）
- ccsight でカバーされない情報（Codex セッション、生ログの詳細解析） → セッションファイル直接参照
- ccsight が利用不能な環境 → セッションファイル直接参照にフォールバック
