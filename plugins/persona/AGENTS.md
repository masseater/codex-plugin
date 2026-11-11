# persona

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
planner / worker / idealist / orchestrator / sparring / pathfinder の 6 つの persona を切り替えるプラグイン。built-in の plan mode などが権限を制御するのに対し、persona は Claude の振る舞いを切り替える。planner の「編集しない」を権限で強制したいときは plan mode と併用する。

## 仕組み

- persona の一覧と注入文は `hooks/lib/state.ts` の `PERSONA_DEFINITIONS` が正。注入文は「役割 1 行＋守ること 2〜3 行＋詳細ガイドの絶対パス」に保つ
- 詳細ガイドは `personas/<name>.md`。skill にしていないのは、description が常時コンテキストに載るのを避け、注入文から絶対パスで Read させるため
- 注入は毎ターン行わない。`inject-persona`（UserPromptSubmit）は state の persona と `<state>.injected` の記録が異なるときだけ注入する。`announce-persona`（SessionStart）は source を問わず、state に persona があれば再注入する。state は session_id ごとなので、実際に当たるのは resume / compact 後である
- `on-exit-plan`（PostToolUse ExitPlanMode）は、persona が planner のときだけ worker に切り替える
- state は `$CLAUDE_PROJECT_DIR/.local-agents/tmp/persona/<session_id>` と `<session_id>.injected` である。前者は persona 名 1 行で、statusline.sh も読む。`cleanup-persona`（SessionEnd）は reason が `clear` のときだけ両方を消す。それ以外の終了では `--resume` / `--continue` で同じ session_id に戻りうるので残す
- 手動の切替は `switch` skill（`disable-model-invocation: true`）。状態を変える操作なので、タイミングはユーザーが決める
- `scripts/statusline.sh` を `statusLine.command` に設定すると、現在の persona を表示できる

## persona を追加・削除するときの同期先

- `hooks/lib/state.ts` の `PERSONA_DEFINITIONS` と `<NAME>_PROMPT`
- `personas/<name>.md`
- `skills/switch/SKILL.md` の description と `argument-hint`
- `scripts/statusline.sh` の `case` 文
- `hooks/entry.test.ts` / `hooks/state.test.ts` / `skills/switch/scripts/persona-state.test.ts`（多くは `PERSONAS` をループするので自動で追随する）
- `.claude-plugin/plugin.json` と marketplace.json の description

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `switch`: このセッションの persona を planner / worker / idealist / orchestrator / sparring / pathfinder に切り替える。clear で解除、status で現在の persona を表示する。
- **hook** `announce-persona`: SessionStart
- **hook** `cleanup-persona`: SessionEnd
- **hook** `inject-persona`: UserPromptSubmit
- **hook** `install-deps`: SessionStart
- **hook** `on-exit-plan`: PostToolUse (`ExitPlanMode`)

<!-- END:component-list -->
