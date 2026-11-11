---
name: daily
description: Obsidian Vault の `04-Daily/YYYY-MM-DD.md` に日記を書き、その日に作成した Zettelkasten ノートを列挙する。ユーザーが「日記を書く」「今日あったこと」「日報」「daily note」のように 1 日の記録を頼んだときに使う。
---

# Daily Notes

日記は 1 日 1 ファイルの時系列の記録で、知識を蓄積する Zettelkasten ノートとは分ける。日記の中に知見（技術的発見・パターン・設計判断）が含まれていたら、日記には残さず Fleeting Note への切り出しを提案する（zettelkasten skill で書く）。

## 形式

ファイル: `~/Documents/Zettelkasten/04-Daily/YYYY-MM-DD.md`

```markdown
---
date: 2026-06-21
tags:
  - daily
---

（本文）

## 今日書いたノート

- [[ノート名1]]
```

本文はユーザーが話した内容を自然な日本語で記録する。箇条書きか散文かはユーザーの話し方に合わせる。

## 手順

1. `bash ../../assets/setup-vault.sh` を実行して Vault をそろえる
2. 当日のファイルがあれば末尾に追記し、無ければ作成する
3. 当日に作成されたノートを `git -C ~/Documents/Zettelkasten log --since=<当日 00:00> --diff-filter=A --name-only --format=` で調べる。それらを「今日書いたノート」に wikilink で列挙する（`04-Daily/` は除く）
4. Vault で commit する
