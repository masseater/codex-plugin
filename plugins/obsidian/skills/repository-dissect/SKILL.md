---
name: repository-dissect
description: リポジトリを分析し、設計判断・アーキテクチャパターン・汎用的な知見を Vault に蓄積する。蓄積先は Zettelkasten の Literature / Permanent ノートと索引ノートである。ユーザーが「このリポジトリを解剖して Zettelkasten に」のように Vault への知見抽出を頼んだときに使う。依存ライブラリの使い方を調べる目的なら research:library-research を使う。
---

# Repository Dissect

対象は引数で指定されたパスか GitHub URL（URL なら `ghq get` で取得する）。引数が無ければカレントディレクトリの git リポジトリ。ノート形式は `../../assets/note-format.md` に従う。

## 手順

1. `bash ../../assets/setup-vault.sh` を実行して Vault をそろえる
2. リポジトリの全体像をつかみ、深掘りする領域（アーキテクチャ、データフロー、独自の規約やコード生成、エラーハンドリング、テスト戦略、CI/CD、セキュリティ境界など）を決める。互いに独立した大きな領域が複数あるときは、領域ごとにサブエージェントへ分析を任せてよい
3. 発見をノートにする
   - このリポジトリの設計判断・構造 → Literature Note。`sources` にリポジトリ名とファイルパスを書き、コードへの言及は permalink にする
   - そのうち他のプロジェクトにも当てはまる知見 → Literature Note から抽出した Permanent Note。元の Literature Note への wikilink を含める。既存の Permanent Note と同じ内容なら新規作成せず、既存ノートに追記して wikilink を張る
4. 索引として `03-Structured-Notes/<リポジトリ名>-解剖マップ.md`（`type: structured`）を作る。冒頭はリポジトリの概要を 1〜2 文で書き、その下へ領域ごとにまとめた wikilink を置く
5. 既存の Vault ノートと関連する新規ノートがあれば、双方向に wikilink を張る
6. Vault で commit し、作成したノートの一覧を報告する
