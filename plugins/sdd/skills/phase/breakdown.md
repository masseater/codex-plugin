---
argument-hint: <タスク名> <phase番号>
description: 指定されたPhaseの詳細タスク計画書を生成
allowed-tools: ["Read", "Write", "Task", "AskUserQuestion"]
---

# Phase詳細計画書を生成

TDDとSOLID原則に基づいた指定Phaseの詳細計画書を `specs/[taskname]/tasks/phase{N}-{name}.md` として生成。

**前提**: Phase構成は `/sdd:phase plan` で決定済みであること。

【引数】
$ARGUMENTS

## Phase分けの基本方針

### 重要な前提条件

**⚠️ 調査・設計はPhase分け前に完了させること**

Phase内に含めてはいけない:

- ❌ 「認証ライブラリの選定」
- ❌ 「データベーススキーマの設計検討」

Phase内に含めるべき:

- ✅ 「ユーザーテーブルのマイグレーション作成」
- ✅ 「認証APIエンドポイントの実装」

### タスク分解の基準

1. **TDDサイクルが完結する単位**: Red → Green → Refactor が1回以上完結
2. **単一の責任を持つ単位**: 名前が「〇〇と△△」なら分割
3. **依存関係が明確**: 並行作業可能なタスクは独立させる

### 共通ルール

**スキル `sdd-workflow` の `common-rules.md` を読み込んで適用すること。**

## 実行手順

### 1. 引数のパースと検証

`$ARGUMENTS` から タスク名 と Phase番号 を抽出。

**引数不足の場合**: AskUserQuestionで選択を求める

### 2. 調査完了の確認

`overview.md` の調査項目表を確認。「未着手」がある場合は警告表示。

### 3. 既存ドキュメントの分析

- `overview.md` から指定Phase情報を抽出
- `specification.md` から機能要件を抽出
- `technical-details.md` から技術仕様を抽出

Phase番号が存在しない場合はエラー終了。

### 5. Phase計画書の生成

**スキル `spec-structure` の `phase-task-template.md` を読み込んでテンプレートとして使用すること。**

**タスク番号の付け方**:

- 直列: 1, 2, 3, ...
- 並列: 2.1, 2.2, 2.3（明示的に並列宣言）

### 6. 完了報告

```
✅ Phase {N} の詳細計画書を生成しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 ファイル: specs/[taskname]/tasks/phase{N}-{name}.md

💡 次のアクション:
   - 計画書を確認・編集
   - 他Phase: `/sdd:phase breakdown [taskname] [N]`
   - 実装開始: `/sdd:phase implement [taskname]`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
