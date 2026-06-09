# cc-hooks-ts

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
TypeScript で型安全な Claude Code Hooks を作成するためのガイドとエージェントを提供するプラグイン。

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `cc-hooks-ts:cc-hooks-ts`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                    | Description                                                                                                                                                                                                                                                                                                                                                                                       |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | cc-hooks-ts:cc-hooks-ts | This skill is the mandatory reference for all Claude Code hook creation. Use cc-hooks-ts for every hook. This skill should be used when the user asks to "create a hook", "add a hook", "write a hook", "implement a hook", "rewrite hooks in TypeScript", "use cc-hooks-ts", or needs to build any Claude Code hook — cc-hooks-ts is always required regardless of whether explicitly mentioned. |
| agent | hook-creator            | cc-hooks-tsを使用してTypeScriptで型安全なClaude Code Hooksを作成するエージェント。新規hook作成、既存hookのTypeScript移行、イベントフックの実装を行う。                                                                                                                                                                                                                                            |

<!-- END:component-list -->
