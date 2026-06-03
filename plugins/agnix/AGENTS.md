# agnix

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
AI アシスタント設定ファイルリンター（agnix）統合

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name             | Description                                                                                                                                                    |
| ----- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | agnix:agnix      | AI コーディングアシスタント設定ファイルのリンター。CLAUDE.md, AGENTS.md, SKILL.md, hooks.json, MCP設定等を検証し、ベストプラクティス違反を検出・自動修正する。 |
| hook  | lint-config-file | PostToolUse (`Write\|Edit`)                                                                                                                                    |

<!-- END:component-list -->
