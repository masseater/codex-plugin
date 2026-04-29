# mutils プラグイン開発ガイド

開発支援コマンド・スキル・Hooksを提供する汎用ユーティリティプラグイン。

## 開発コマンド

```bash
cd plugins/mutils
bun run check        # lint + format チェック
bun run check:fix    # 自動修正
bun run typecheck    # 型チェック
bun run knip         # 未使用コード検出
```

## Hooks 実装

Hook implementation details: see [docs/hook-implementation-guide.md](docs/hook-implementation-guide.md)

## 注意事項

- Hooks は複数インスタンスから同時実行される可能性あり
- ファイル書き込みは追記モードを使用
- lib/config.ts に共通設定を配置

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                            | Description                                                                                                                                                                                                                                                                                                                                                                     |
| ----- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | feedback                        | Send feedback about this plugin repository as a GitHub issue. Use when the user says "feedback", "send feedback", "report issue", "bug report", "feature request", "フィードバック", "バグ報告", "機能リクエスト", or wants to create an issue for the plugin repository.                                                                                                       |
| skill | ideal-driven-design             | 理想を絶対に忘れずに、手段にとらわれずに設計案が理想を満たしているかを徹底的に議論してから設計を確定するためのスキル。Use when the user says '理想から設計', '理想駆動', '理想を満たす設計', '手段にとらわれず設計', '本質から設計', 'ideal driven design', 'north star design', or wants to design something starting from the ideal state without being constrained by means. |
| skill | investigate-repo                | Investigate the current repository to surface issues, defects, and improvement opportunities. Use when the user says "調査して課題", "リポジトリを調査", "investigate repo", "find issues in repo", "問題を洗い出す", "課題を見つける", or wants a structured report of problems detected in the codebase.                                                                      |
| skill | mutils:ccs-handoff              | Use when a CCS profile hits rate limits, usage caps, or context overflow. Reads session data from another profile and resumes interrupted work.                                                                                                                                                                                                                                 |
| skill | mutils:dig                      | Clarify ambiguities in plans with structured questions                                                                                                                                                                                                                                                                                                                          |
| skill | mutils:issue-plan               | GitHub IssueのURLまたは番号から内容を取得し、実装計画を立案します                                                                                                                                                                                                                                                                                                               |
| skill | mutils:multi-angle-perspectives | 一般的・保守的・独創的な3つの観点からそれぞれ2つずつ提案を生成します                                                                                                                                                                                                                                                                                                            |
| skill | mutils:pls-auq                  | AskUserQuestionの制約内で個別に同時に質問するよう指示                                                                                                                                                                                                                                                                                                                           |
| skill | mutils:recommended              | おすすめのClaude Code設定・プラグイン・MCPサーバーを紹介                                                                                                                                                                                                                                                                                                                        |
| skill | mutils:reflection               | Reflect on what you have been doing in this session and identify what could have been done better                                                                                                                                                                                                                                                                               |
| skill | mutils:setup                    | mutilsプラグインのセットアップ                                                                                                                                                                                                                                                                                                                                                  |
| skill | skill-create                    | This skill should be used when the user asks to 'create a skill', 'add a new skill', 'make a skill', 'scaffold a skill', 'new skill', 'スキル化して', 'スキルを作成', 'スキルを追加', or wants to create a new Claude Code skill for a plugin or project. Provides a guided workflow with automated scaffolding, validation, and dynamic context injection.                     |
| skill | task-history                    | Review past task and TODO history from previous sessions. Use when asked to review past work, check what was done, or reflect on completed tasks.                                                                                                                                                                                                                               |
| skill | temp-skill                      | Save and manage temporary notes across sessions. Triggered by phrases like "save temp", "add temp", "list temp", "search temp", "read temp", "show temp", or their Japanese equivalents ("一時メモ", "temp に保存", "temp 一覧", "temp 検索", "temp 読む", etc.). Saves as Markdown files in ~/.claude/skills/temp/ with index management.                                      |
| skill | workspace-id                    | Use when creating workspace directories for agent work. Defines the canonical workspace-id format, directory structure, and file naming convention.                                                                                                                                                                                                                             |
| hook  | block-husky-bypass              | PreToolUse (Bash)                                                                                                                                                                                                                                                                                                                                                               |
| hook  | block-unsafe-type-assertion     | PreToolUse (Write\|Edit)                                                                                                                                                                                                                                                                                                                                                        |
| hook  | check-context-version           | SessionStart                                                                                                                                                                                                                                                                                                                                                                    |
| hook  | send-notification               | Stop                                                                                                                                                                                                                                                                                                                                                                            |
| hook  | suggest-plan-enhancer           | PreToolUse (ExitPlanMode)                                                                                                                                                                                                                                                                                                                                                       |
| hook  | suggest-todo                    | UserPromptSubmit, Stop                                                                                                                                                                                                                                                                                                                                                          |
| hook  | task-history                    | PostToolUse (TodoWrite\|TaskCreate\|TaskUpdate)                                                                                                                                                                                                                                                                                                                                 |
| hook  | workspace-id-persist            | SessionStart                                                                                                                                                                                                                                                                                                                                                                    |

<!-- END:component-list -->
