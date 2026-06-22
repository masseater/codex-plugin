# codex-plugin

`masseater/claude-code-plugin` の `main` を Codex 用 marketplace / plugin 形式へ変換して保持するリポジトリです。

## Sync

ローカルで同期する場合:

```bash
python3 scripts/sync_upstream.py
```

既定では upstream の default branch を解決して追従します。

ローカル checkout を同期元に使う場合:

```bash
python3 scripts/sync_upstream.py --source /path/to/claude-code-plugin
```

同期すると次を再生成します。

- `plugins/*`
- `.agents/plugins/marketplace.json`
- `.sync/upstream.json`

通常は生成物を直接編集せず、`scripts/sync_upstream.py` を更新してください。

## Automation

GitHub Actions で定期同期と手動同期を行います。更新があれば同期 PR を作成します。
