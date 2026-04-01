---
argument-hint: <タスク名> [挿入位置]
description: 未着手Phaseの前または末尾に新しいPhaseを挿入
allowed-tools: ["Read", "Edit", "Bash", "AskUserQuestion"]
---

# Phaseを追加

既存のPhase構成に新しいPhaseを追加する。

【引数】
$ARGUMENTS

## 制約

- **完了済み・進行中Phaseの前への挿入は禁止**
- **完了済み・進行中のファイルは一切変更しない**
- **未着手のPhaseファイルのみリネーム可能**
- 論理番号とファイル名は常に一致させる

## 実行手順

### 1. 引数のパースと検証

`$ARGUMENTS` からタスク名を抽出。挿入位置は省略可能（デフォルト: 末尾）。

**タスク名未指定の場合**: AskUserQuestion で選択

### 2. 現在のPhase構成を読み取り

`specs/{taskname}/overview.md` から:

- Phase構成テーブル
- 各Phaseの状態（未着手/進行中/完了）

`specs/{taskname}/tasks/` から:

- 既存の phase{N}-{name}.md ファイル一覧

### 3. 挿入位置の決定

**挿入可能な位置**:

- 最初の「未着手」Phaseの位置 〜 末尾

**例**:

```
Phase 1: 完了      ← 変更不可
Phase 2: 進行中    ← 変更不可
Phase 3: 未着手    ← ここ以降に挿入可能（リネーム対象）
Phase 4: 未着手    ← リネーム対象
```

挿入位置の指定:

- 数字（例: `3`）→ Phase 3 の前に挿入
- 省略 → 末尾に追加

**禁止操作の検出**:
完了済み・進行中Phaseの前に挿入しようとした場合はエラー:

```
❌ エラー: Phase {N}（{状態}）の前には挿入できません
挿入可能位置: Phase {M} 以降（最初の未着手Phase）
```

### 4. 新しいPhaseの情報を収集

AskUserQuestion で以下を質問:

- Phase名称
- 目標（1-2行）
- 成果物
- 依存するPhase（複数選択可）

### 5. 未着手Phaseファイルのリネーム

挿入位置以降の未着手Phaseファイルを番号順にリネーム（後ろから処理）:

```bash
# 例: Phase 3 の前に挿入する場合
mv tasks/phase4-ui.md tasks/phase5-ui.md
mv tasks/phase3-api.md tasks/phase4-api.md
```

**注意**: ファイル内の status frontmatter が `not_started` または `未着手` であることを確認してからリネーム

### 6. overview.md の更新

#### Phase構成テーブルの更新

挿入位置以降のPhase番号をシフト:

**更新前**:

```markdown
| Phase | 名称  | 目標 | 依存    | 成果物 |
| ----- | ----- | ---- | ------- | ------ |
| 1     | Setup | ...  | -       | ...    |
| 2     | Core  | ...  | Phase 1 | ...    |
| 3     | API   | ...  | Phase 2 | ...    |
| 4     | UI    | ...  | Phase 3 | ...    |
```

**Phase 3 の前に挿入後**:

```markdown
| Phase | 名称        | 目標   | 依存    | 成果物   |
| ----- | ----------- | ------ | ------- | -------- |
| 1     | Setup       | ...    | -       | ...      |
| 2     | Core        | ...    | Phase 1 | ...      |
| 3     | [新規Phase] | [目標] | [依存]  | [成果物] |
| 4     | API         | ...    | Phase 2 | ...      |
| 5     | UI          | ...    | Phase 4 | ...      |
```

**注意**: 依存関係の「Phase N」参照も適宜更新する（シフトした番号に合わせる）

#### Phase詳細セクションの更新

同様に番号をシフトし、新しいPhaseを追加:

```markdown
#### Phase 3: [新規Phase名]

- **目標**: [目標]
- **成果物**: [成果物]
- **状態**: 未着手
```

### 7. 完了報告

```
✅ Phase を追加しました
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 タスク: [taskname]
📊 新規Phase: Phase {N} - [Phase名]
🔄 リネーム:
   - phase{old}-{name}.md → phase{new}-{name}.md
   - ...

💡 次のアクション:
   - 詳細計画を作成: /sdd:phase breakdown [taskname] {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
