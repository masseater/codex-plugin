---
name: sdd:workflow
description: SDDワークフロー全体のガイド。SDD コマンドを実行する時に、全てのコマンドで読み込む必要がある。
hooks:
  Stop:
    - matcher: ".*"
      hooks:
        - type: prompt
          prompt: |
            セッション終了前に `/sdd:quality-check` を実行して品質チェックを行ってください。
          once: true
---

# SDD Workflow Guide

SDDは **仕様書に基づいて段階的に実装を進める** 開発手法。
各コマンドを実行する際は、常に **内部品質チェック** の基準に従うこと。

## Quick Start

```
1. 初回のみ: steering スキルでプロジェクト方針定義
2. タスク作成: /sdd:spec init <説明>
3. 各コマンド完了時に次のアクションが案内される
```

## Step Overview

| Step | 目的                     | 主要コマンド                                                      |
| ---- | ------------------------ | ----------------------------------------------------------------- |
| 0    | プロジェクト方針         | steering スキル                                                   |
| 1    | タスク初期化・設計・定義 | `/sdd:spec init`, `/sdd:spec requirements`, `/sdd:spec technical` |
| 2    | 調査・明確化             | `/sdd:research conduct`, `/sdd:research clarify`                  |
| 3    | Phase構成決定            | `/sdd:phase plan`                                                 |
| 4    | Phaseサイクル            | `/sdd:phase breakdown`, `/sdd:phase implement`, `/sdd:validate`   |

## 生成されるディレクトリ構造

```
.claude/skills/steering/   # プロジェクト全体のステアリング（Progressive Disclosure）
└── SKILL.md               # Product, Tech Stack, Structure, Principles

specs/
├── research/            # 調査結果
├── {spec}/              # タスク別仕様書
│   ├── overview.md
│   ├── specification.md
│   ├── technical-details.md
│   └── phases/phase*.md
└── _archived/           # アーカイブ済み
```

## 詳細ガイド

- **Step別詳細**: See [step-guide.md](./references/step-guide.md)
- **共通ルール**: See [common-rules.md](./references/common-rules.md)

## よくある使い方

### 新しいタスクを始める

```bash
/sdd:spec init ユーザー認証機能を追加
# → 完了時に次のアクションが案内される
# → /sdd:research conduct で技術調査（調査項目がある場合）
# → /sdd:spec requirements で要件定義
```

### 進捗確認

```bash
/sdd:status  # 現在の進捗を確認
/sdd:next    # 次に何をすべきか確認
# sdd-webappで全タスクの進捗を可視化
# MCPツール: sdd_webapp_get_status
```

### 作業中断前

```bash
/sdd:sync  # 実装状況をドキュメントに反映
```

### 自動進行

```bash
/sdd:autopilot  # 自動進行モードで実行
```

### ヘルプ

```bash
/sdd:help  # SDDの使い方を確認
```
