---
name: agnix
description: agnix CLI で Claude Code の設定ファイルをベストプラクティス違反の観点で lint し、修正する。対象は CLAUDE.md / AGENTS.md / SKILL.md / hooks.json / plugin.json / settings.json / .mcp.json / .claude/rules である。「AGENTS.md を lint して」「SKILL.md の設定ミスを検査して」と頼まれたときに使う。
---

# agnix

この plugin の PostToolUse hook は、上記の設定ファイルを編集するたびに `agnix --format json <file>` を実行し、error か warning があれば結果を返す。ここではまとめて検査・修正するときの使い方を書く。

## コマンド

- 検査: `agnix <path>`（`<path>` はファイルかディレクトリ）。終了コードは error があるときだけ 1 で、warning だけなら 0 になる。`--target` は非推奨で、付けると毎回非推奨の警告が出るので付けない。対象ツールを絞るときは `.agnix.toml` の `tools` 配列で指定する
- 修正の差分を確認: `agnix --dry-run --show-fixes <path>`
- 確度の高い修正だけ適用: `agnix --fix-safe <path>`
- 警告もエラー扱い（CI 向け）: `agnix --strict <path>`

既定は `--fix-safe` にする。`--fix` の範囲は版によって違う（安全な修正だけの版と、確度が中程度の修正まで含む版がある）。そのため `--fix` や `--fix-unsafe` を使う前に `agnix --help` で意味を確かめ、`--dry-run --show-fixes` で差分を見てから適用する。

## インストール

`agnix` が PATH に無いと hook は何もしない。`npm install -g agnix` で入れ、`agnix --version` で確認する。
