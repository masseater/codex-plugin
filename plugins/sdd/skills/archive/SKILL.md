---
name: sdd:archive
argument-hint: ""
description: 完了または不要になったspecsをアーカイブします
---

specs/配下のタスクを一覧表示し、選択したタスクを`specs/_archived/`ディレクトリに移動してください。
アーカイブ理由はoverview.mdのPhase statusから自動判定します。

## 実行手順

### 1. タスク一覧の取得

1. `specs/`ディレクトリが存在するか確認
2. 存在しない場合、エラーメッセージを表示して終了
3. `specs/`配下のディレクトリ一覧を取得（`_archived`を除外）
4. タスクが存在しない場合、「アーカイブ可能なタスクがありません」と表示して終了

### 2. 各タスクのプロジェクトステータス確認

各タスクについて以下を実行:

1. `specs/[taskname]/overview.md`を読み込む
2. 「## プロジェクトステータス」セクションの「**ステータス**:」フィールドを読み取る
3. ステータスが「完了」または「却下」のタスクのみをアーカイブ対象とする
4. `overview.md`が存在しない、またはプロジェクトステータスが取得できない場合 → アーカイブ対象外

### 3. AskUserQuestionツールでタスクを選択

1. アーカイブ対象タスク（ステータスが「完了」または「却下」）の一覧を「タスク名（ステータス）」の形式で表示
   - 例: `user-authentication（完了）`、`payment-integration（却下）`
2. ユーザーに選択させる
3. 選択されたタスク名とステータスを取得

### 4. アーカイブディレクトリの準備

1. `specs/_archived/`ディレクトリが存在するか確認
2. 存在しない場合、作成する
3. `specs/_archived/[taskname]/`が既に存在する場合、エラーメッセージを表示して終了
   - エラーメッセージ: 「既にアーカイブされています: specs/\_archived/[taskname]/」

### 5. Gitリポジトリの確認と移動

1. `git rev-parse --is-inside-work-tree`を実行して確認
2. 成功した場合（Gitリポジトリ内）:
   - `git mv specs/[taskname] specs/_archived/[taskname]`を実行
   - コミットメッセージ: `Archive spec: [taskname] ([ステータス])`
3. 失敗した場合（Gitリポジトリ外）:
   - `mv specs/[taskname] specs/_archived/[taskname]`を実行

### 6. Gitコミット（Gitリポジトリの場合のみ）

Gitリポジトリ内の場合:

```bash
git commit -m "$(cat <<'EOF'
Archive spec: [taskname] ([ステータス])

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### 7. 完了報告

以下を報告:

- アーカイブ先パス: `specs/_archived/[taskname]/`
- プロジェクトステータス: [完了/却下]

## エラーハンドリング

### specs/ディレクトリが存在しない場合

```
エラー: specs/ディレクトリが見つかりません
```

### アーカイブ可能なタスクがない場合

```
アーカイブ可能なタスクがありません
```

### 既にアーカイブされている場合

```
エラー: タスク「[taskname]」は既にアーカイブされています
specs/_archived/[taskname]/ が既に存在します
```
