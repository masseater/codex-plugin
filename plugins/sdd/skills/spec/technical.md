---
argument-hint: <タスク名>
description: 技術詳細とアーキテクチャ設計を作成
allowed-tools: ["Read", "Write", "Edit", "Glob", "Grep", "Task", "AskUserQuestion"]
---

# 技術詳細ドキュメントを作成

タスクの技術仕様とアーキテクチャ設計を詳細化し、`technical-details.md` を生成。

## 重要事項

- 推測ではなく、ステアリングドキュメントに基づいて判断すること
- 判断できない箇所は「**不明**」と明記し、複数案がある場合は列挙すること
- 生成後、sdd:validate スキルを用いて実際のプロジェクト構造との整合性を検証してください。

【対象タスク名】
$ARGUMENTS

## 実行手順

### 1. タスクディレクトリの確認

- `specs/[taskname]/overview.md` と `specification.md` の存在確認
- タスク名未指定の場合: AskUserQuestionで選択

### 3. 既存ドキュメントの読み込み

- `overview.md` - プロジェクト概要
- `specification.md` - 機能要件、データ要件
- `specs/_steering/tech.md` - 既存の技術スタック
- `specs/_steering/structure.md` - コード構造、命名規則

### 4. technical-details.mdの生成

**スキル `spec-structure` の `technical-details-template.md` を読み込んでテンプレートとして使用すること。**

**生成時の注意**:

- steering/tech.md に記載の技術スタックを**必ず使用**
- 逸脱する場合は明確な理由を記述
- specification.mdとの役割分担を明確に（機能要件 vs 技術実装）

**スキル `sdd-workflow` の `common-rules.md` を読み込んで適用すること。**

### 5. 完了報告

```
✅ 技術詳細ドキュメントを作成しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 作成先: specs/[taskname]/technical-details.md

💡 次のアクション:
   - Phase構成決定: `/sdd:phase plan [taskname]`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
