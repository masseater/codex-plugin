# cc-hooks-ts

TypeScript で型安全な Claude Code Hooks を作成するためのガイドとエージェントを提供するプラグイン。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name         | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | cc-hooks-ts  | This skill is the mandatory reference for all Claude Code hook creation. Use cc-hooks-ts for every hook. This skill should be used when the user asks to "create a hook", "add a hook", "write a hook", "implement a hook", "rewrite hooks in TypeScript", "use cc-hooks-ts", or needs to build any Claude Code hook — cc-hooks-ts is always required regardless of whether explicitly mentioned. |
| agent | hook-creator | cc-hooks-tsを使用してTypeScriptで型安全なClaude Code Hooksを作成するエージェント。新規hook作成、既存hookのTypeScript移行、イベントフックの実装を行う。                                                                                                                                                                                                                                            |

<!-- END:component-list -->
