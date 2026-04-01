# Phase別詳細ガイド

SDDワークフローの各Phaseの詳細説明。

## Phase 0: ステアリングドキュメント作成（初回のみ）

### 目的

プロジェクト全体の「永続的メモリ」を作成する。

### 方法

- steering スキル - Bootstrap Mode（新規作成）またはSync Mode（更新）

### 生成ファイル

- `.claude/skills/steering/SKILL.md` - Product, Tech Stack, Structure, Principles を統合

### 重要

ステアリングドキュメントは Claude の Progressive Disclosure により文脈に応じて自動参照される。

---

## Phase 1: タスク初期化・調査

### 目的

新しいタスクの骨格を作成し、調査項目を特定する。

### コマンドフロー

```
/sdd:spec init <説明>
    ↓ (実装概要・調査項目も同時に特定、sdd-webapp自動登録)
/sdd:research conduct {taskname} [項目名]
```

### 各コマンドの役割

| コマンド           | 入力             | 出力                                                |
| ------------------ | ---------------- | --------------------------------------------------- |
| `spec:init`        | 計画の説明       | `overview.md`（目的、スコープ、実装概要、調査項目） |
| `research:conduct` | タスク名、項目名 | `specs/research/[項目名].md`                        |

---

## Phase 2: 要件・技術詳細の定義

### 目的

機能要件、非機能要件、技術仕様を定義する。

### コマンドフロー

```
/sdd:spec requirements {taskname}
    ↓
/sdd:spec technical {taskname}
```

### 各コマンドの役割

| コマンド            | 出力                                            |
| ------------------- | ----------------------------------------------- |
| `spec:requirements` | `specification.md`（機能要件、非機能要件）      |
| `spec:technical`    | `technical-details.md`（技術スタック、API設計） |

---

## Phase 3: 仕様の検証・明確化

### 目的

不明点の解消と仕様書間の矛盾チェック。

### コマンド

- `/sdd:research clarify {taskname}` - ユーザーに質問（ビジネス要件）
- `/sdd:quality-check {taskname}` - 品質チェック（矛盾検出・ステアリング準拠確認）

### clarify vs conduct

- `research:clarify`: **ユーザーに聞く**（ビジネス要件）
- `research:conduct`: **AIが調べる**（技術的検証）

---

## Phase 4: Phase構成の決定

### 目的

タスクをどのようなPhaseに分割するか決定する。

### 前提条件

`overview.md` の全調査項目が「完了」状態であること。

### コマンド

- `/sdd:phase plan {taskname}` - Phase名、目標、依存関係、成果物を定義

### 重要

詳細なタスク計画は次の `/sdd:phase breakdown` で個別に作成する。

---

## Phase 5: Phase詳細計画

### 目的

各Phaseの詳細タスク計画を作成する。

### コマンド

- `/sdd:phase breakdown {taskname} {N}` - Phase Nの詳細計画

### 生成ファイル

- `specs/{taskname}/tasks/phase{N}-{name}.md`

### 計画書の内容

- タスク一覧（タスク番号、TDDステップ）
- 各タスクの詳細説明
- 依存関係
- テスト戦略

---

## Phase 6: Phase実装

### 目的

計画書に基づいて実装を進める。

### コマンド

- `/sdd:phase implement {taskname}` - Phase 1から開始
- `/sdd:phase implement {taskname} {phase}.{task}` - 特定タスクから開始
- `/sdd:sync` - 実装状況をドキュメントに同期

### 実装サイクル

```
phase:implement で実装
    ↓
sync で状況を記録（中断時）
    ↓
phase:implement で続行
```

---

## Phase 7: Phase検証

### 目的

Phase完了時の統合検証。

### コマンド

- `/sdd:validate {taskname} {N}` - 統合検証（validate スキル参照）

### 検証内容

1. ドキュメント検証
2. 要件検証
3. 品質検証

### 総合評価

- ✅ Phase完了可能 → 次のPhaseへ
- ⚠️ 一部に問題あり → 修正後再検証
- ❌ 重大な問題あり → 修正必須

---

## タスク完了後

### コマンド

- `/sdd:archive` - 完了タスクをアーカイブ

### アーカイブ先

- `specs/_archived/{taskname}/`
