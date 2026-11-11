# similarity-ts データソースガイド

TypeScript / JavaScript コードの重複を検出する Rust 製 CLI ツール。コードレベルの繰り返しパターン（共通化や lint ルール化の候補）を発見するために使う。

## インストール

```bash
cargo install similarity-ts
```

## 基本的な使い方

```bash
# カレントディレクトリ以下の全 TS/JS ファイルをスキャン
similarity-ts .

# 特定のディレクトリをスキャン
similarity-ts src/

# しきい値を指定（デフォルトより厳しく）
similarity-ts . --threshold 0.8

# 最小行数を指定
similarity-ts . --min-lines 5

# クロスファイル分析
similarity-ts . --cross-file
```

## 出力の読み方

重複が検出されると、ファイルパスと行番号のペアで類似箇所が表示される。類似度スコアが付与されるため、しきい値で絞り込める。

## automation-advisor での活用

```pseudocode
function detect_code_duplication(repo_path):
  result = exec("similarity-ts {repo_path} --cross-file --threshold 0.7")

  // 出力をパースし、繰り返しパターンとして返す
  // 高頻度の重複 → 共通化 or lint ルール化の提案候補
```

## 注意点

- Rust のツールチェーンが必要（`cargo` コマンド）
- インストールされていない場合はスキップし、他のデータソースで補完する
- 大規模リポジトリではスキャン時間が長くなるため、ディレクトリを絞ることを推奨
