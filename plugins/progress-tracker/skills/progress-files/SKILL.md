---
name: progress-tracker:progress-files
description: 'This skill should be used when the user asks to "continue previous work", "過去の進捗を確認", "中断した作業の続き", "progress files", or wants to recover context from previous session progress files.'
---

# Progress Files - 過去の進捗を参照する

## 進捗ファイルの場所

```
.agents/progress/*.md
```

ファイル名は `YYYY-MM-DD_HH-MM-SS.md` 形式（セッション開始時刻）。ソートすると時系列順になる。

## 過去の進捗を参照する

### 最新の進捗を確認

```bash
# 最新3件のファイルを取得
ls .agents/progress/*.md | sort -r | head -3
```

取得したファイルを読んで、前回までの作業状況を把握する。

### キーワードで検索

```bash
# 特定キーワードを含むファイルを検索
grep -l "認証" .agents/progress/*.md

# コンテキスト付きで検索
grep -C 3 "TODO" .agents/progress/*.md
```

## 進捗ファイルの構造

```markdown
# Session YYYY-MM-DD_HH-MM-SS

## YYYY-MM-DD_HH-MM-SS

- 達成したこと
- 課題や次のステップ
```

各 `## YYYY-MM-DD_HH-MM-SS` セクションは Stop イベント時に追加される。「TODO」「次回」「残タスク」などのキーワードで未完了タスクを探す。

## セッション開始時にやること

1. `ls .agents/progress/*.md | sort -r | head -3` で最新ファイルを確認
2. 最新の進捗ファイルを読む
3. 未完了タスクや引き継ぎ事項を把握して作業を開始
