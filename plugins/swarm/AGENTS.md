# swarm

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Agent Teams（swarm）支援 - チーム設計・運用・振り返りガイド

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `swarm:swarm`
- `swarm:team-design`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name              | Description                                                                                                                                                                                                       |
| ----- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | swarm:swarm       | This skill should be used when the user asks to "create an agent team", "use Agent Teams", "swarmで進める", "チームを設計して実行", or wants an interactive Agent Teams composition launched for a task.          |
| skill | swarm:team-design | This skill should be used when the user asks to "design an agent team", "Agent Teamsの構成", "チーム構成を考えて", "role-based team", or wants role-based Agent Teams composition guidance without launching yet. |

<!-- END:component-list -->
