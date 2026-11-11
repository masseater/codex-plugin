# debug - プラグインデバッグ用

Claude Code プラグイン開発時のデバッグ用プラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install debug
```

---

## Hooks

SessionStart 時に次のデバッグ出力を行う。

- `$XDG_STATE_HOME/claude-code-plugin/debug.txt`（既定は `~/.local/state/...`）に `CLAUDE_PLUGIN_ROOT` を書き込む。セッションの外から plugin の解決先を確認できる
- additionalContext で、debug plugin が有効であることと `CLAUDE_PLUGIN_ROOT` の値を Claude に渡す

---

## 用途

- プラグインのインストール・読み込み確認
- `CLAUDE_PLUGIN_ROOT` 環境変数の確認
- SessionStart hook の動作確認
