---
argument-hint: <タスク名>
description: Phase構成を決定してoverview.mdに追加（詳細なタスク分解はしない）
allowed-tools: ["Read", "Edit", "Task", "AskUserQuestion"]
---

# Phase構成を決定

調査完了後に、タスクをPhaseに分割する構成を決定し、`overview.md` に追加。

## 重要事項

- このコマンドは詳細なタスク分解を行わない。Phase構成のみを決定します。

【対象タスク名】
$ARGUMENTS

## 実行手順

### 1. タスクディレクトリの確認

必須ファイルの存在確認:

- `overview.md`
- `specification.md`
- `technical-details.md`

タスク名未指定の場合: AskUserQuestionで選択

### 3. 調査完了の確認

`overview.md` の調査項目表を確認。「未着手」がある場合は警告表示。

### 4. 既存ドキュメントの分析

以下から情報を抽出してPhase構成を決定:

- `overview.md` - 調査結果、実装概要
- `specification.md` - 機能要件、優先度
- `technical-details.md` - 技術スタック、アーキテクチャ

### 5. Phase構成の提案

**Phase分けの基準**:

1. 独立してデプロイ・リリース可能な単位
2. 機能の依存関係による分割
3. リスクとビジネス価値による優先順位付け

**インターフェースファースト原則**:
各Phaseの計画では、モデルや型定義からではなく、**使い方・使われ方（インターフェース）を先に定義**する。

- ❌ 「まずUserモデルを定義して、次にリポジトリを作って...」
- ✅ 「ユーザーはこう使う → APIはこう呼ばれる → 内部実装はこうなる」

理由:

- 実際の使用シナリオから設計することで、不要な抽象化を防ぐ
- 外部との契約（API、UI）が先に固まり、内部実装の変更が容易になる
- テスタビリティが向上する（モックしやすい境界が明確）

**Phase数**: 制約なし。プロジェクトの複雑度に応じて柔軟に決定。

### 6. ユーザーへの確認

AskUserQuestionで確認:

- 承認 → overview.md更新
- 修正が必要 → 調整後再提案
- やり直し → 再提案

### 7. overview.mdの更新

以下のセクションを追加:

- Phase概要と依存関係（各Phaseの状態、目標、依存、成果物）
- Phase依存関係図（Mermaid）
- シーケンス図（Mermaid）

### 8. 完了報告

```
✅ Phase構成を決定しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 更新先: specs/[taskname]/overview.md
📊 Phase数: [N]個

💡 次のアクション:
   - Phase 1の詳細計画: `/sdd:phase breakdown [taskname] 1`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
