# persona

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
planner / worker カスタムペルソナを切り替えるプラグイン。

Claude の built-in モード（plan / acceptEdits 等）は権限制御のためのものでClaude本体の「振る舞い」は変えない。
このプラグインは、明示的に切り替え可能な「議論パートナー (planner) / 実行者 (worker)」というペルソナを別レイヤとして提供する。

## ペルソナ

- **planner**: 議論・批判・深掘り質問に徹する。実装には踏み込まない
- **worker**: 議論を打ち切り、与えられたタスクを最小スコープで忠実に実行する

## Manual Switching

Slash command は廃止。手動切替は `persona:switch` skill を直接呼び出す。

| Skill argument           | 動作                            |
| ------------------------ | ------------------------------- |
| `persona:switch planner` | ペルソナを planner に切り替える |
| `persona:switch worker`  | ペルソナを worker に切り替える  |
| `persona:switch clear`   | ペルソナ設定をクリア            |
| `persona:switch status`  | 現在のペルソナを表示            |

## 自動遷移

- planner 中に `ExitPlanMode` ツールが呼ばれて plan が承認されると、`PostToolUse` hook が決定論的に **worker** に切り替える
- これ以外の自動遷移はない（worker→planner は手動 `persona:switch planner` のみ）

## State

セッション単位で管理。
ファイル: `$CLAUDE_PROJECT_DIR/.agents/tmp/persona/<session_id>`
内容: `planner` または `worker` の1行。なければ未設定扱い。
`SessionEnd` hook で当該セッションのファイルを削除（GC）。

## Statusline

`scripts/statusline.sh` を `~/.claude/settings.json` の `statusLine.command` に設定すると、
現在のペルソナを statusline に常時表示できる。

## Skills

- `persona:planner` — planner の詳細な振る舞いガイド
- `persona:worker` — worker の詳細な振る舞いガイド
- `persona:switch` — planner / worker / clear / status の手動切替

UserPromptSubmit hook で注入される最小プロンプトに「迷ったらこの skill を読め」と書いてあるので、
Claude は必要に応じて自発的に参照する。

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

この plugin では、AI が自然文から自律起動すべき skill は定義しない。設計判断: persona の切替・注入は hook と手動状態操作で完結し、`planner` / `worker` の詳細ガイドは hook が注入した persona 指示を補足する内部参照である。自然文 trigger を定義して自律起動させると、通常会話で persona guide が過剰に読み込まれる。

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name             | Description                                                                                                                                                |
| ----- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | persona:planner  | Internal planner persona behavior guide referenced by persona hooks and direct skill invocation.                                                           |
| skill | persona:switch   | Manual persona state command replacement for direct skill invocation only. Switches planner / worker state, clears it, or displays current persona status. |
| skill | persona:worker   | Internal worker persona behavior guide referenced by persona hooks and direct skill invocation.                                                            |
| hook  | announce-persona | SessionStart                                                                                                                                               |
| hook  | cleanup-persona  | SessionEnd                                                                                                                                                 |
| hook  | inject-persona   | UserPromptSubmit                                                                                                                                           |
| hook  | on-exit-plan     | PostToolUse (`ExitPlanMode`)                                                                                                                               |

<!-- END:component-list -->
