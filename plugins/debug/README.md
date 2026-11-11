# debug - プラグインデバッグ用

Claude Code プラグイン開発時のデバッグ用プラグイン。

## インストール

```bash
/plugin marketplace add https://github.com/masseater/codex-plugin
/plugin install debug
```

---

## Hooks

SessionStart 時に以下のデバッグ出力を行います：

| 出力先                                         | 内容                                                     |
| ---------------------------------------------- | -------------------------------------------------------- |
| `$XDG_STATE_HOME/claude-code-plugin/debug.txt` | `CLAUDE_PLUGIN_ROOT` を書き込み                          |
| additionalContext (system-reminder)            | debug プラグインが有効であることとCLAUDE_PLUGIN_ROOTの値 |

---

## 用途

- プラグインのインストール・読み込み確認
- `CLAUDE_PLUGIN_ROOT` 環境変数の確認
- SessionStart hook の動作確認
