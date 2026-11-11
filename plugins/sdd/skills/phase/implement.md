---
argument-hint: <taskname> [phase.task]
allowed-tools: ["Read", "Write", "Edit", "Bash", "Task", "AskUserQuestion", "TodoWrite"]
---

# 仕様書に基づいて実装作業を実行

specs/[taskname]/配下の仕様書ドキュメントを読み込み、それに基づいて実装作業を行う。

【引数】
$ARGUMENTS

## 引数の形式

- `[taskname]` のみ: Phase 1から開始
- `[taskname] [phase].[task]`: 指定したPhaseとタスクから開始
  - 例: `user-authentication 2.3` → Phase 2のタスク3から開始

## 実行手順

### 1. TodoWriteで実装ステップを追加

最初に以下のTodoを追加:

1. タスクとPhaseの特定
2. 仕様書の読み込み
3. Phase状況の確認
4. 実装作業の実行

### 2. タスクとPhaseの特定

- 引数あり: 指定されたタスク/Phaseを対象
- 引数なし: `specs/` から対話的に選択

### 3. 仕様書の確認

以下を読み込み:

- `overview.md` - 全体概要とPhase構成
- `specification.md` - 機能要件、非機能要件
- `technical-details.md` - 技術的な実装方針
- `tasks/phase{N}-{name}.md` - 該当Phaseの計画書

### 5. 現在の状況確認

- 各Phaseの状態（未着手/進行中/完了）
- 実装可能なPhaseの特定（依存関係考慮）
- ブロッカーの有無

### 6. 作業開始位置の決定

- `[phase].[task]` 指定あり: そのタスクから開始（依存関係確認）
- 指定なし: AskUserQuestionで選択

### 7. タスクの確認と実行計画

Phase計画書からTodoWriteに実装タスクを追加し、AskUserQuestionで確認。

### 8. 実装作業

各Todoについて:

1. Todoを `in_progress` に更新
2. 実装（any型禁止、関数型スタイル意識）
3. 品質チェック
4. テスト実装
5. Todoを `completed` に更新

**スキル `sdd-workflow` を読み込んで適用すること。**

### 9. 完了報告と状態更新

```
✅ タスク [Phase.Task] の実装が完了しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 対象: specs/{taskname}/ - Phase {N}, Task {M}
🌐 進捗はsdd-webappで可視化されています

💡 次のアクション:
   - 次のタスク: `/sdd:phase implement {taskname} {phase}.{task+1}`
   - Phase検証: `/sdd:validate {taskname} {phase}`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**状態更新**: overview.mdとphase計画書のタスク状態を更新
