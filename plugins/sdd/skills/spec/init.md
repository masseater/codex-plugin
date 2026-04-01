---
argument-hint: <計画の説明>
description: 仕様書（spec）の骨格を作成（テンプレートコピー）
allowed-tools: ["Read", "Write", "Edit", "Bash", "Task"]
---

# 仕様書（spec）の骨格を作成

計画の説明をもとに、仕様書の骨格を作成する。

**スキル `spec-template` を読み込んでテンプレートをコピーすること。**

## 重要事項

- 不明なところは勝手に決めずに「**不明**」と明記すること
- 「将来的に必要になる」「今後〜が必要」といった推測に基づいた記述は禁止
- 現時点で明確に必要なことのみを記載すること

【計画内容】
$ARGUMENTS

## 実行手順

### 1. 引数チェック

`$ARGUMENTS` が空の場合、作成したい内容についてユーザーに質問する

### 2. spec名の生成

計画内容から適切なspec名を生成:

- 英数字とハイフンのみ。specs/内で一意になる名称。
- 例: `user-authentication`, `payment-integration`
- AskUserQuestionで確認

### 3. テンプレートコピー

`spec-template` スキルのスクリプトを実行:

```bash
../spec-template/scripts/copy-templates.ts specs/{spec}
```

### 4. テンプレートの更新

コピーされた各ファイルを計画内容に合わせて更新:

- `overview.md` を計画内容で更新
- 各テンプレート内の「記載のポイント」に従う

### 5. 完了報告

```
✅ 仕様書（spec）の骨格を作成しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 作成先: specs/{spec}/

💡 次のアクション:
   - 要件定義: `/sdd:spec requirements {spec}`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
