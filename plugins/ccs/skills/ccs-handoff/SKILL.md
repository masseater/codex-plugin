---
name: ccs-handoff
description: 別の CCS プロファイルのセッションがレート制限・利用上限・コンテキスト溢れで止まったとき、そのセッションの要約・未完了タスク・直近のやり取りを読み込んで作業を引き継ぐ。「CCS のセッションを引き継いで」「レート制限で止まった作業を続けて」と頼まれたときに使う。引数は `<profile> <sessionId>`。
argument-hint: "<profile> <sessionId>"
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/ccs-handoff.ts *), Read, Glob, Grep
---

# ccs-handoff

## 手順

1. `$ARGUMENTS` を空白で分け、1 つ目をプロファイル名、2 つ目をセッション ID とする。足りなければユーザーに聞く
2. 引き継ぎ情報を取得する

   ```bash
   ${CLAUDE_SKILL_DIR}/ccs-handoff.ts <profile> <sessionId>
   ```

3. 出力をもとに作業状態を戻す
   - Session Info の Project Path に移動する
   - Session Info のブランチと現在のブランチを比べ、違えばユーザーに伝える。ブランチは切り替えない（作業ツリーの未コミット変更を巻き込むため）
   - 「Pending Tasks」「Pending TODOs」の項目を、このセッションのタスクリストに登録し直す
   - Session Summary、First Prompt、Recent Messages から、何をしていたかを把握する
   - `git status`、`.agents/workspaces/`（作業ディレクトリ）、`.local-agents/plans/`（計画ファイル）も見て補う
   - Subagents の節でサブエージェントの存在が検出されていれば、ユーザーに伝える
4. 進行中だった作業、タスクの状態、ブランチや文脈の食い違い、次の手順を短く報告し、そのまま作業を続ける
