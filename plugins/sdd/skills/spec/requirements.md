---
argument-hint: <タスク名>
description: 機能要件と非機能要件の詳細仕様を作成
allowed-tools: ["Read", "Write", "Task", "AskUserQuestion"]
---

# 詳細要件仕様書を作成

タスクの機能要件と非機能要件を詳細化し、`specification.md` を生成。

【対象タスク名】
$ARGUMENTS

## 実行手順

### 1. タスクディレクトリの確認

- `specs/[taskname]/overview.md` の存在確認
- タスク名未指定の場合: AskUserQuestionで選択

### 3. 非機能要件の確認

AskUserQuestion（複数選択可）で必要な非機能要件を確認：

- □ パフォーマンス要件
- □ 可用性要件
- □ 保守性要件
- □ ユーザビリティ要件
- □ 制約条件
- □ テスト戦略
- □ 開発環境

**注**: セキュリティ要件は常に含まれる

### 4. specification.mdの生成

**スキル `spec-structure` の `specification-template.md` を読み込んでテンプレートとして使用すること。**

**生成時の注意**:

- ユーザーが選択しなかった非機能要件セクションは含めない
- 実装Phase番号は空欄（plan-phasesで決定後に追加）

**スキル `sdd-workflow` の `common-rules.md` を読み込んで適用すること。**

### 5. 完了報告

```
✅ 詳細要件仕様書を作成しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 作成先: specs/[taskname]/specification.md

💡 次のアクション:
   - 技術詳細化: `/sdd:spec technical [taskname]`
   - 不明点の明確化: `/sdd:research clarify [taskname]`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
