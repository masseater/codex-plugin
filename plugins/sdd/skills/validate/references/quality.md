---
argument-hint: <taskname> <phase番号>
---

# Phase実装の品質検証

指定したPhaseの実装コードの品質、コーディング規約、テストを検証します。

【引数】
$ARGUMENTS

## 引数の形式

- `<taskname>` - タスク名（specs/[taskname]/ディレクトリ）
- `<phase番号>` - 検証対象のPhase番号（1, 2, 3...）

## 検証手順

### 1. 準備

- 引数の解析（未指定の場合はAskUserQuestionで確認）
- `specs/[taskname]/tasks/phase{N}-*.md` の存在確認
- Phase計画書から実装ファイルリストを抽出

### 2. コーディング規約チェック

実装ファイルをGrepツールでチェック：

**禁止事項**:

- `any`型の使用（`pattern: "\bany\b"`）→ ファイルパス:行番号を記録
- barrel import/export（`pattern: "export \* from"`）→ ファイルパス:行番号を記録

**要確認**:

- `interface`の使用（`pattern: "^\s*interface\s+"`）→ コメントで理由が説明されているか確認

### 3. テストの確認と実行

- 各実装ファイルに対応するテストファイル（`*.test.ts`, `*.spec.ts`等）の存在確認
- AskUserQuestionでテストコマンドを確認（例: `volta run --node $(cat .node-version) yarn test`）
- テストを実行し、成功/失敗/スキップ数を記録

### 4. 品質チェックコマンドの実行

- AskUserQuestionで品質チェックコマンドを確認（例: `yarn lint && yarn type-check && yarn build`）
- 各コマンドを実行し、結果を記録：
  - Lint: エラー数、警告数
  - Type check: 型エラー数
  - Build: 成功/失敗

### 5. Phase間の実装品質チェック（Phase 2以降のみ）

- 前Phaseの成果物がimportされているか（Grepで`import`文を検索）
- 型の互換性確認（type-checkの結果を参照）

### 6. 検証結果レポート

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Phase {N} 品質検証レポート
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 specs/{taskname}/ - Phase {N}
📅 {YYYY-MM-DD HH:MM}

## 総合評価

{✅ / ⚠️ / ❌}

## 検証結果

### コーディング規約

- any型: {✅/❌} {違反数}件
- barrel import/export: {✅/❌} {違反数}件
- interface使用: {✅/⚠️}
  {違反がある場合: ファイルパス:行番号}

### テスト

- テストファイル: {exists}/{expected}
- 実行結果: 成功 {passed} / 失敗 {failed} / スキップ {skipped}

### 品質チェック

- Lint: {✅/⚠️/❌} {エラー}E / {警告}W
- Type check: {✅/❌} {エラー}件
- Build: {✅/❌}

### Phase間統合（Phase 2以降）

{✅/⚠️/❌/N/A}

## 🚨 要対応項目

{問題のリスト}

## 💡 次のアクション

✅: Phase完了可能。overview.mdを「完了」に更新推奨
⚠️: 警告を解決後、再検証（`/sdd:verify:quality {taskname} {N}`）
❌: 重大な問題を解決後、再検証

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 7. 問題への対応（⚠️/❌の場合）

AskUserQuestionで各問題の対応方針を確認（最大4問/回）：

- 選択肢に「修正する」「対応しない」等を含める
- 選択後、TodoWriteでタスク作成

### 8. overview.md更新提案（✅の場合のみ）

AskUserQuestionで「overview.mdのPhase状態を『完了』に更新しますか？」と確認。

## 注意事項

- `.node-version`がある場合は`volta run`を使用
- テスト・品質チェックコマンドは必ずユーザーに確認
- コーディング規約（`any`禁止、barrel禁止）は厳格にチェック

## 品質チェック（必須）

品質検証後、**sdd-workflowスキルの品質ルールに従ってください**。
