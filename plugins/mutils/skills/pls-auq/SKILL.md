---
name: mutils:pls-auq
description: AskUserQuestionの制約内で個別に同時に質問するよう指示
---

これから質問する内容を全て出力してから AskUserQuestion してください。確認事項はまとめずに個別の質問として聞くこと。
複数の確認事項がある場合は、AskUserQuestionの制約内で一つにまとめず最大限同時に質問してください。
回答に応じてファイルを編集する場合は「どのファイル」の「どの部分」を「どのように」編集するかを質問の description に含めてください。

## 悪い例（このようにしないで）

```
Q. 以下の要件についてどうしますか？
- 要件A: ...
- 要件B: ...
- 要件C: ...

[1] 全部対応 [2] 一部対応 [3] 対応しない
```

## 良い例（このようにする）

AskUserQuestionで最大4つまで同時に質問する：

```
questions: [
  { question: "要件A", ... },
  { question: "要件B", ... },
  { question: "要件C", ... },
  { question: "要件D", ... },
]
```

5つ以上ある場合は、最初の4つを聞いて→回答待ち→残りを聞いて、としてください。

## 具体例：実装方針の確認

### 悪い例

```
Q. 以下の機能についてどう実装しますか？
- 認証機能
- データ永続化
- エラーハンドリング
- ログ出力
- テスト

[1] 全部自作 [2] 一部はライブラリ使用 [3] ライブラリ中心
```

この聞き方だと「認証はライブラリ、データ永続化は自作」のような組み合わせを選べません。

**良い例**: 個別に質問を作成し、AskUserQuestionの制約内で最大限まとめて質問する。

2026-01-22 現在、AskUserQuestionの最大数は4つなので、4つごとにまとめること。

#### ユーザーに聞く例

````md
認証機能: 実装方法を明確にする。

- 1: 自作 {具体的なメリデメ} {回答後のアクション}
- 2: ライブラリ {具体的なメリデメ} {回答後のアクション}

<!-- 他の質問も同様に -->

...

```json
questions: [
  {
    question: "認証機能はどう実装しますか？",
    options: [
      { label: "自作", description: "JWT等を自分で実装" },
      { label: "ライブラリ", description: "NextAuth等を使用" }
    ]
  },
  {
    question: "データ永続化はどう実装しますか？",
    options: [
      { label: "SQLite", description: "ローカルファイルベース" },
      { label: "PostgreSQL", description: "外部DBサーバー" }
    ]
  },
  {
    question: "エラーハンドリングはどう実装しますか？",
    options: [
      { label: "try-catch", description: "手動で実装" },
      { label: "ライブラリ", description: "Sentry等を使用" }
    ]
  },
  {
    question: "ログ出力はどう実装しますか？",
    options: [
      { label: "console.log", description: "標準出力" },
      { label: "pino/winston", description: "構造化ログ" }
    ]
  }
]
```
````
