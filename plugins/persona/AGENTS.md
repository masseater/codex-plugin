# persona

planner / worker カスタムペルソナを切り替えるプラグイン。

Claude の built-in モード（plan / acceptEdits 等）は権限制御のためのものでClaude本体の「振る舞い」は変えない。
このプラグインは、明示的に切り替え可能な「議論パートナー (planner) / 実行者 (worker)」というペルソナを別レイヤとして提供する。

## ペルソナ

- **planner**: 議論・批判・深掘り質問に徹する。実装には踏み込まない
- **worker**: 議論を打ち切り、与えられたタスクを最小スコープで忠実に実行する

## Slash Commands

| コマンド           | 動作                            |
| ------------------ | ------------------------------- |
| `/persona-planner` | ペルソナを planner に切り替える |
| `/persona-worker`  | ペルソナを worker に切り替える  |
| `/persona-clear`   | ペルソナ設定をクリア            |
| `/persona-status`  | 現在のペルソナを表示            |

## 自動遷移

- planner 中に `ExitPlanMode` ツールが呼ばれて plan が承認されると、`PostToolUse` hook が決定論的に **worker** に切り替える
- これ以外の自動遷移はない（worker→planner は手動 `/persona-planner` のみ）

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

UserPromptSubmit hook で注入される最小プロンプトに「迷ったらこの skill を読め」と書いてあるので、
Claude は必要に応じて自発的に参照する。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name             | Description                                                                                                                                                   |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | persona:planner  | planner ペルソナの詳細な振る舞いガイド。議論・批判・深掘りに徹し、実装には踏み込まない。Claudeが現ペルソナでの振る舞いに迷ったときに参照する。                |
| skill | persona:worker   | worker ペルソナの詳細な振る舞いガイド。議論を打ち切り、与えられたタスクを最小スコープで忠実に実行する。Claudeが現ペルソナでの振る舞いに迷ったときに参照する。 |
| hook  | announce-persona | SessionStart                                                                                                                                                  |
| hook  | cleanup-persona  | SessionEnd                                                                                                                                                    |
| hook  | inject-persona   | UserPromptSubmit                                                                                                                                              |
| hook  | on-exit-plan     | PostToolUse (`ExitPlanMode`)                                                                                                                                  |

<!-- END:component-list -->
