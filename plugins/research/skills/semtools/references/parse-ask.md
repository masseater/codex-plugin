# semtools parse / ask

どちらも外部 API キーが必要。キーは `~/.semtools_config.json`（各コマンドの `-c/--config` で別パス可）か環境変数で与える。優先順位は CLI 引数 > 設定ファイル > 環境変数。

```json
{
  "parse": { "api_key": "llx-..." },
  "ask": { "api_key": "sk-...", "model": "gpt-4o-mini" }
}
```

## parse

PDF・DOCX・PPTX を Markdown に変換する。キーは `parse.api_key` か `LLAMA_CLOUD_API_KEY`。

```bash
semtools parse document.pdf
semtools parse docs/*.pdf | xargs semtools search "API endpoints"   # 変換結果をそのまま検索
```

- `-b, --backend <backend>`: 変換バックエンド（既定 `llama-parse`）

## ask

検索と読み取りのツールを持つエージェントが、文書群に対する質問に答える。キーは `ask.api_key` か `OPENAI_API_KEY`。

```bash
semtools ask "リフレッシュトークンの有効期限は？" docs/*.md
semtools ask "移行手順を要約して" --workspace my-workspace
```

- `--model <model>`: 設定ファイルのモデルを上書きする
- `--api-key` / `--base-url` / `--api-mode <chat|responses>`: OpenAI 互換 API の接続設定を上書きする
