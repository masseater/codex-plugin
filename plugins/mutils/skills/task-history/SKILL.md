---
name: task-history
description: mutils の task-history hook が記録したタスク・TODO の履歴（TodoWrite / TaskCreate / TaskUpdate）を照会する。過去のセッションで何をしたか、何が未完了のまま残っているかを示す。「前回の続きをやりたい」「前のセッションで残ったタスクを見せて」「過去の作業を振り返って」と頼まれたときに使う。
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/query.ts), Bash(${CLAUDE_SKILL_DIR}/query.ts *)
---

# task-history

履歴はリポジトリの `.agents/mutils/mutils.db` に、セッション ID ごとに記録されている。git リポジトリの中で実行する。

## コマンド

```bash
${CLAUDE_SKILL_DIR}/query.ts [options]
```

- `--open`: セッションごとに未完了のタスクだけを出す。「前回の続き」はこれを使う
- `--recent N`: 直近 N 件（`--open` では直近 N セッション）。既定 50
- `--session ID`: セッションを絞る
- `--status STATUS`: `pending` / `in_progress` / `completed` で絞る
- `--since DATE`: ISO 形式の日付以降に絞る（例: `--since 2026-01-31`）

## 使い分け

- 前回の続き: `--open` で未完了のタスクを出し、ユーザーにどれを再開するか確認してから、このセッションのタスクリストに登録し直す
- 振り返り: 既定の出力をセッションごとにまとめ、完了したことと残ったことを要約する
