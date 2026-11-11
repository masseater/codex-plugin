---
name: semtools
description: semtools CLI（@llamaindex/semtools）でファイル内容を意味で検索する。grep ではキーワードが一致せず目的の箇所が見つからないとき、自然言語のクエリで Markdown・コード・ログなどを探すときに使う。
user-invocable: false
---

# semtools

`semtools search` と `semtools workspace` はローカルで動き、API キーは要らない。PDF / DOCX / PPTX の Markdown 変換（`parse`、LlamaParse キーが必要）と文書への質問応答（`ask`、OpenAI キーが必要）は [references/parse-ask.md](references/parse-ask.md) を読む。

## search

```bash
semtools search "<クエリ>" <files...> [--max-distance <float>] [--top-k 3] [--n-lines 3] [--json] [--workspace <name>] [-i]
```

- distance は小さいほど近い。`--max-distance` には既定値が無く、未指定だと距離に関係なく上位 `--top-k` 件を返すので、弱い一致も混ざる。結果は distance を見て関連度を判断する
- 同じファイルは異なる distance で複数回返る場合がある。ファイル単位では最小の distance で判断する
- しきい値の正解値はコーパスと埋め込みで変わる。まず `--max-distance` なし（`--json` も便利）で距離の分布を見て、強い一致と弱い一致の間に置く。いきなり厳しい値を決め打ちすると 0 件になりやすい
- `--max-distance` を指定すると `--top-k` は無視される

## workspace

多数のファイルを繰り返し検索するときは、ワークスペースで埋め込みをキャッシュする。明示的な index 構築コマンドは無く、検索時に対象ファイルが自動で取り込まれ、変更分だけ再計算される。

```bash
semtools workspace use <name>            # 作成・有効化。有効化用の export が出力される
semtools search "<クエリ>" docs/*.md --workspace <name>
semtools workspace status                # 初回検索後は Index: Yes (HNSW)
semtools workspace prune                 # 欠損エントリの削除
```

`export SEMTOOLS_WORKSPACE=<name>` はそのシェル内でしか効かない。Bash ツールのようにコマンドごとに環境が消える場合は、各 search に `--workspace <name>` を付ける。ワークスペースは `~/.semtools/workspaces/` に保存される。
