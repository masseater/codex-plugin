# 類似 Issue の判定

`search.ts` は候補ごとに合成スコア `score = 0.7 * bm25Norm + 0.2 * labelJaccard + 0.1 * recency` と各成分を返す。検索は FTS5 trigram なので言語に依存せず、ML モデルは使わない。

## 類似度

`bm25Norm` は検索結果の中での min-max 正規化（`1 - (rank - minRank) / range`）なので、最上位の候補は常に 1.0 になり、結果が 1 件なら無関係でも 1.0 になる。絶対的な類似度としては使わず、候補を読む順番の目安にする。

- `high`: 候補の本文に finding と同じファイルパス・シンボル・エラーメッセージが出てきて、同じ問題を指している。構造的な根拠が必要で、スコアだけでは `high` にしない
- `medium`: `score >= 0.55` で、本文を読むと同じ領域（同じ機能・同じモジュール）の別の問題だと判断できる
- `low`: `score >= 0.30`
- それ未満は捨てる

タイトルの一致だけでは `high` にしない。タイトルで判断できない候補は `<plugin-root>/scripts/issue-db/show.ts <number>` でキャッシュ済みの本文とコメントを読む。そのうえで最も強い根拠（一致したシンボル・パス・エラーメッセージ・言い換え）を 1 文で記録する。

`score` のしきい値は経験的な初期値。既知の重複で何度か試し、ずれていればリポジトリごとに調整する。

## 推奨

SKILL.md の手順 4 はこの区分で分岐する。

- `duplicate`: open の `high` が 1 件以上ある。新規起票せず既存 Issue にコメントする
- `closed-duplicate`: `high` は closed だけにある。reopen を頼むか、`Related: #<n>` 付きで新規起票するかをユーザーに聞く
- `related`: `high` はなく、`medium` がある（open か closed かは問わない）。新規起票して `Related: #<n>` でつなぐ
- `no-match`: `medium` 以上がない。新規起票してよい
