---
name: switch
disable-model-invocation: true
description: このセッションの persona を planner / worker / idealist / orchestrator / sparring / pathfinder に切り替える。clear で解除、status で現在の persona を表示する。
argument-hint: "planner|worker|idealist|orchestrator|sparring|pathfinder|clear|status"
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/persona-state.ts *)
---

# persona の切替

次を実行し、出力の `persona` を 1 行で報告する。引数がなければ `status` を渡す。

```bash
${CLAUDE_SKILL_DIR}/scripts/persona-state.ts --project-dir "${CLAUDE_PROJECT_DIR}" --session ${CLAUDE_SESSION_ID} $ARGUMENTS
```

- persona 名を渡すとその persona に切り替わり、次のプロンプトで hook がその persona の指示を注入する
- `clear` は persona を解除し、`status` は現在の persona を表示する（未設定なら `null`）
- 状態は `${CLAUDE_PROJECT_DIR}/.local-agents/tmp/persona/<session_id>` に保存される
