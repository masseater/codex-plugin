# CCS 委譲のトラブルシューティング

エラーメッセージや症状から該当する項目を探す。

## 設定

- `Profile 'X' not configured` / `Settings file not found`: 設定ファイルが無い。`ccs doctor` で不足しているプロファイルを確認する
- `Invalid API key`（401）: `~/.ccs/<profile>.settings.json` のトークンを確認し、期限切れなら再発行する
- settings の JSON parse error: `jq . ~/.ccs/<profile>.settings.json` で壊れている箇所を探す
- `Invalid profile name`: `ccs doctor` で存在するプロファイル名を確認する

## 実行

- `No previous session`: `:continue` の前に `ccs <profile> -p "<task>"` で新規セッションを作る
- `Missing prompt`: `-p` の直後にプロンプトを引用符で渡す
- `No profile specified`: `ccs <profile> -p "<task>"` の形で呼ぶ
- ファイルが見つからない: 委譲はカレントディレクトリで実行される。cwd を確認する
- 実行が 10 分でタイムアウトする、メモリ不足、SIGTERM: タスクを小さく分ける

## セッション

- セッションファイルが壊れた: `rm ~/.ccs/delegation-sessions.json` で初期化する（全セッションの記録が消える）
- セッションの期限切れ（30 日超）: 新規の委譲から始める
- セッション ID が見つからない: `jq '.<profile>' ~/.ccs/delegation-sessions.json` で記録を確認する
- コスト集計のエラー: 実行には影響しない。気になる場合はセッションを初期化する

## ネットワーク

- タイムアウト、エンドポイントに届かない: 接続と settings の `ANTHROPIC_BASE_URL` を確認して再試行する
- 429（レート制限）: 60 秒待って再試行する
- SSL / TLS エラー: システムの証明書と、プロキシによる SSL 検査を確認する

## Claude CLI

- Claude CLI が無い: Claude Code をインストールする
- バージョンが古い（stream-json や `--permission-mode` 非対応）: `ccs update` か `ccs sync` で更新し、`claude --version` で確認する

## 診断

```bash
ccs doctor                                   # 全プロファイルの状態
ccs --version                                # CCS のバージョン
CCS_DEBUG=1 ccs <profile> -p "<task>" 2>&1 | tee debug.log   # 詳細ログ
jq . ~/.ccs/delegation-sessions.json         # セッションの記録
```
