# debug

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
plugin debug 用

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `debug:plugin-debug`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name               | Description                                                                                                                                                                                                                        |
| ----- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | debug:plugin-debug | This skill should be used when the user asks about 'debug plugin behavior', 'what does the debug plugin save', 'debug plugin files', 'where does debug plugin write', or mentions debug plugin data storage and session artifacts. |
| hook  | session-start      | SessionStart                                                                                                                                                                                                                       |

<!-- END:component-list -->
