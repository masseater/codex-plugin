---
name: research:semtools
description: 'This skill should be used when the user asks to "semantic search", "自然言語で検索", "semtools", "search files by meaning", or wants to search file contents using natural-language queries.'
---

# semtools - セマンティック検索 CLI

`@llamaindex/semtools`（Rust 製・npm 配布）。コマンドはすべて `semtools <subcommand>` 形式で実行する。

## コマンド一覧

- `semtools search` — ローカルセマンティック検索
  - API: 不要（ローカル）
- `semtools workspace` — 検索キャッシュ（ワークスペース）管理
  - API: 不要
- `semtools parse` — PDF/DOCX/PPTX → Markdown 変換
  - API: LlamaParse
- `semtools ask` — 文書ベースの質問応答
  - API: OpenAI

`search` と `workspace` はローカルのみで完結し API キー不要。`parse` は LlamaParse、`ask` は OpenAI のキーが必要。

## search - セマンティック検索

```
semtools search [OPTIONS] <QUERY> [FILES]...
```

grep の代わりにセマンティック（意味的）な検索ができる。キーワードが完全一致しなくても関連する内容を見つける。

```bash
# 基本的な使い方（クエリの後にファイルを列挙）
semtools search "検索クエリ" file1.md file2.md

# 進捗ファイルを検索
semtools search "認証機能の実装" .agents/progress/*.md

# 距離しきい値を調整（小さいほど厳密）
semtools search "API設計" docs/*.md --max-distance 0.3

# 前後の行数を指定
semtools search "エラーハンドリング" src/*.ts --n-lines 5
```

### オプション

- `-n, --n-lines <int>`: マッチ前後の文脈行数（デフォルト: 3）
- `--top-k <int>`: 返す上位ファイル/テキスト数（デフォルト: 3）。`--max-distance` 指定時は無視される
- `-m, --max-distance <float>`: 類似度しきい値（0.0+、小さいほど厳密）。**デフォルトなし** — 未指定なら距離に関わらず `top-k` 件を返すため、関連度で絞りたいときは明示する
- `-i, --ignore-case`: 大文字小文字を無視
- `-j, --json`: JSON 形式で出力
- `-w, --workspace <name>`: 使用するワークスペースを指定

distance（距離）は小さいほど類似度が高い。`top-k` は弱い一致も含めて上位を返すので、返り値は distance を見て関連度を判断する。同一ファイルが異なる distance で複数回返ることがあるため、ファイルパス単位では最小 distance を採用して判断する。

`--max-distance` の適切なしきい値はコーパス・埋め込みに依存する（固定の正解値は無い）。まず `--max-distance` 未指定（または `--json`）で距離分布を確認し、強い一致と弱い一致の間に閾値を置く。いきなり厳しい値を決め打ちすると「0 件」の空振りになりやすい。

## workspace - 大規模検索のキャッシュ

多数のファイルを繰り返し検索する場合、ワークスペースを作成すると埋め込みがキャッシュされ高速化する。**明示的な index 構築コマンドは無い** — 検索実行時に対象ファイルが自動で取り込まれ、変更分だけ再計算される（初回検索後は `semtools workspace status` が `Index: Yes (HNSW)` と表示する）。

サブコマンド: `use`（作成/有効化）/ `status`（状態確認）/ `prune`（不要・欠損エントリの削除）。

```bash
# ワークスペースを作成/有効化（有効化用の export コマンドが出力される）
semtools workspace use my-workspace
# → 出力された export を実行して有効化する
export SEMTOOLS_WORKSPACE=my-workspace

# 以降の search はワークスペースを使用（初回検索でファイルを自動取り込み）
semtools search "クエリ" docs/*.md

# 単発でワークスペースを指定する場合は --workspace フラグでも可
semtools search "クエリ" docs/*.md --workspace my-workspace

# 状態確認 / クリーンアップ
semtools workspace status
semtools workspace prune
```

ワークスペースは `~/.semtools/workspaces/` に保存される。

`export SEMTOOLS_WORKSPACE=...` はそのシェルセッション内でのみ有効。コマンドを 1 回ずつ実行する環境（セッションをまたぐと env が消える）では、`export VAR=... && semtools search ...` と同一コマンドで連結するか、各 search に `--workspace <name>` を付ける。

## parse - ドキュメント変換

```
semtools parse [OPTIONS] <FILES>...
```

PDF、DOCX、PPTX を Markdown に変換する。**LlamaParse API キーが必須**（下記「設定」参照）。

```bash
semtools parse document.pdf
semtools parse reports/*.docx
semtools parse scan.pdf --backend llama-parse   # デフォルトの backend
```

- `-b, --backend <backend>`: 変換バックエンド（デフォルト: `llama-parse`）
- `-c, --config <path>`: 設定ファイルのパス（デフォルト: `~/.semtools_config.json`）

## ask - 文書ベース質問応答

```
semtools ask [OPTIONS] <QUERY> [FILES]...
```

検索と読み取りツールを持つ AI エージェントが、文書コレクションに対して質問に回答する。**OpenAI API キーが必須。**

```bash
semtools ask "リフレッシュトークンの有効期限は？" docs/*.md
semtools ask "移行手順を要約して" --workspace my-workspace
```

- `--model <model>`: 使用モデル（設定ファイルを上書き）
- `--api-key <key>` / `--base-url <url>` / `--api-mode <chat|responses>`: OpenAI 互換 API 接続設定の上書き

## パイプライン例

```bash
# PDF を変換してから検索
semtools parse docs/*.pdf | xargs semtools search "API endpoints"

# grep と組み合わせ
semtools search "認証" src/*.ts | grep -v test
```

## 設定

統一設定ファイル `~/.semtools_config.json`（各コマンドの `-c/--config` で別パス指定可）。全セクション任意:

```json
{
  "parse": { "api_key": "llx-..." },
  "ask": { "api_key": "sk-...", "model": "gpt-4o-mini" }
}
```

環境変数でも与えられる: `LLAMA_CLOUD_API_KEY`（parse）/ `OPENAI_API_KEY`（ask）。

優先順位: **CLI 引数 > 設定ファイル > 環境変数**。

## 参考

- https://github.com/run-llama/semtools
