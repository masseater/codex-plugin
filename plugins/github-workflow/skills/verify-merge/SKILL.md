---
name: verify-merge
description: base の取り込みや conflict 解消の結果に、意図しない変更の混入・ブランチの変更の消失・コンフリクトマーカーの残りがないかを検出する。merge や conflict 解消の後、push の前に使う。「マージ結果を確認して」「コンフリクト解消が正しいか見て」と頼まれたときにも使う。
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/*)
---

# Verify Merge

検出と報告だけを行い、修正はしない（呼び出し元の `pr-watch` などが直す）。

merge で conflict マーカーが残らなくても、両側の変更を結合した結果ロジックが壊れる、片側の変更が静かに消える、といった意味的な誤りが起こりうる。mergiraf のような構文レベルの自動マージを設定した環境では、conflict も自動解決されるのでこの誤りに気付きにくい。設定の有無は gitattributes の `merge=mergiraf` と `git config --get merge.mergiraf.driver` で確認できる。この skill はそれを拾うためにある。

## 手順

1. 比較スクリプトを実行する。対象 PR の base は自動で解決する。PR がない、または別の base と比べたいときは `--base origin/<branch>` を渡す

   ```bash
   ${CLAUDE_SKILL_DIR}/scripts/verify-merge.ts [--base origin/<branch>]
   ```

   出力は `findings[]` で、ファイルごとに次を持つ（問題のないファイルは含まれない）。
   - `extraAdded` / `extraRemoved`: `base...HEAD` の正味の差分にあるが、ブランチ自身の非 merge コミットにはない行。base 側の変更の巻き込みや、解消時に紛れた変更の疑い
   - `lostAdded`: ブランチのコミットで追加したのに正味の差分から消えた行
   - `lostRemoved`: ブランチのコミットで削除したのに復活した行
   - `conflictMarkerLines`: 作業ツリーに残ったマーカーの行番号

2. 各 finding について実ファイルを読み、意図どおりかを判断する。行単位の比較なので、次は正当な差として出ることがある
   - base 側のリネームや API 変更に合わせてブランチのコードを書き換えた（`extraAdded` と `lostAdded` が対になる）
   - フォーマッタによる空白・改行位置の変化

   それ以外に、マーカーがなくても、import の重複・欠落、同じ定義の二重化、片側の変更を採ったせいで他の箇所と整合しなくなった箇所を確認する

3. 結果を報告する。問題があればファイル・行・何が起きているかを、なければ確認したファイル数と問題なしの旨を伝える

判断は既定ではこのセッションが行う。`findings` のあるファイルが 20 以上ある場合だけ、ファイルごとの判断をサブエージェントに分けてよい。
