---
name: zettelkasten
description: Zettelkasten Vault（~/Documents/Zettelkasten）にノートを書き、既存ノートと wikilink で接続して commit する。ユーザーが「メモして」「ノートにして」「Zettelkasten に保存」のように記録を頼んだとき、またはセッション知見の書き出しを促されたときに使う。
---

# Zettelkasten ノートの書き出し

ノートの形式・種別・ソースリンク規約は `../../assets/note-format.md` に従う。

## 手順

1. `bash ../../assets/setup-vault.sh` を実行し、Vault と pre-commit hook がそろっていることを保証する（冪等）
2. 書く内容を決める。ユーザーの依頼ならその内容、セッション知見の書き出しなら次のものを候補にする
   - 技術的な発見、問題解決のパターン、設計判断とその根拠、調査で得た知見、既存の理解を覆す情報
   - 作業ログや手順の羅列は書かない。後から別の文脈で再利用できる知見だけを残す
3. ノート種別を決める。ユーザーが指定していればそれに従う
   - 文献・Web・コードから読み取った内容 → literature
   - 自分の気付き・思考の断片 → fleeting
   - Literature や既存の Permanent を統合する → permanent（Fleeting の統合は下記）
   - テーマ別の索引 → structured
4. 書く前に Vault を検索し、同じトピックのノートがあれば新規作成せず追記する。関連ノートがあれば wikilink を張る
5. ノートを作成・更新し、Vault で commit する
6. 作成・更新したノートのパスとタイトルを報告する

Fleeting Notes を Permanent Note に統合する作業は削除と commit を伴うので、ここでは行わない。統合候補に気付いたら、ユーザーに `/obsidian:maintain` を提案する。
