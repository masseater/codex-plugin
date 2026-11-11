# PR Queue State

作成: <YYYY-MM-DD HH:MM>

## 依存チェーン（base をチェーン設定済み）

- <順番>. #<number> <status> — base: <base>、元の base: <original base>、依存: [#<n>, ...]
  - <1 行要約>
  - 依存理由: #<n> の <export / ファイル> を使う

## 独立 PR（base は変更しない）

- <順番>. #<number> <status> — base: <base>
  - <1 行要約>

## ログ

- <HH:MM> #<number> <pending → merged などの遷移と理由>
