---
name: maintain
description: Zettelkasten Vault の健全性チェック・統計・修復をし、Fleeting Notes を Permanent Note へ統合する。
disable-model-invocation: true
---

# Vault メンテナンス

ノート形式は `../../assets/note-format.md` に従う。最初に `bash ../../assets/setup-vault.sh` を実行し、pre-commit hook が未設置なら設置する。

## チェック

Vault 全体を走査し、次をまとめて報告する。

- リンク切れ: どのノートにも解決しない `[[wikilink]]`（参照元ノートとリンク名）
- 孤立ノート: どこからも wikilink されていないノート。`03-Structured-Notes/` の索引は除く
- frontmatter 不整合: `type` が配置ディレクトリと食い違う、`title` が無い、`created` が ISO 8601 でない
- 未統合 Fleeting Notes: `01-Fleeting-Notes/` のノートを、共通するタグ・テーマでグループ化したもの
- 統計: ノート総数、種別ごとの数、タグごとの数、1 ノートあたりの平均リンク数、孤立ノート数

## 修復と統合

報告のあと、実施する項目をユーザーに選んでもらう。修復と統合はノートの書き換え・削除と commit を伴うため、承認された項目だけを実行する。

- リンク切れ: リンク先ノートを作るか、リンクを直す・外す
- frontmatter: 不足・誤りを直す
- Fleeting の統合: グループごとに `02-Permanent-Notes/` へ Permanent Note を作る。統合元の内容をパラフレーズして体系化し、関連する Literature Notes への wikilink を含める。統合した Fleeting Notes は削除し、それらへの既存の wikilink を新しい Permanent Note に張り替える

実施後に Vault で commit し、変更したノートを報告する。
