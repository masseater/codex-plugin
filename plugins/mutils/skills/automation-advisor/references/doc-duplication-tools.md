# ドキュメント重複検出ツールガイド

リポジトリ内の Markdown ファイル間で同じ記述が複数箇所に散在していないかを検出するためのツール群。AGENTS.md / SKILL.md / rules 間の重複発見に使う。

## markdown-duplicate-checker

Markdown ファイル間の完全一致・近似重複を検出する専用ツール。

- リポジトリ: https://github.com/viralburst/markdown-duplicate-checker
- 機能: 完全一致検出、Jaccard 類似度によるクラスタリング、diff レポート生成
- 使い方: `./scripts/detect_md_dups.sh <target-dir>/`

## Duplicate Finder

テキスト / Markdown / XML 対応の汎用重複検出ツール。

- サイト: https://flounder.dev/duplicate-finder/
- 機能: 100% 重複と類似コンテンツの両方を検出、類似度しきい値指定可能
- 使い方:
  - `-i=md` — Markdown としてパース
  - `-f=md,mdx` — ファイル種別フィルタ
  - `-s=0.85` — 類似度しきい値

## 簡易的な代替手段

専用ツールがインストールされていない場合、次の方法で代替できる。

```pseudocode
function detect_doc_duplication_simple(repo_path):
  md_files = glob(repo_path + "**/*.md")

  // 各ファイルをセクション単位で分割
  sections = {}
  for file in md_files:
    for section in split_by_heading(file):
      hash = content_hash(normalize(section.body))
      sections[hash].append({file, section})

  // 同一ハッシュに複数ファイルが紐付くものが重複
  duplicates = sections.filter(s => len(s) > 1)
  return duplicates
```

## automation-advisor での活用

ドキュメント重複の発見は「未言語化型」の一種として扱う。同じ記述が複数箇所にあるということは、共通の参照先（shared reference / asset）に統合すべきパターンを示唆する。
