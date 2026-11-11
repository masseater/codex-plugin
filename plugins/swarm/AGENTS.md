# swarm

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Agent Teams（swarm）のチーム設計と起動・運用を支援する。

- `swarm` は `disable-model-invocation: true`。Agent Teams はトークンコストが高く、ユーザーが明示したときだけ使う（mutils の個人 AGENTS.md と同じ方針）
- role 設計のテンプレートとアンチパターンは `skills/swarm/references/team-design.md` にある

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

- **skill** `swarm`: タスクに合わせて Agent Teams のチームを role ベースで設計し、承認を得て起動・運用する。`design-only` を渡すと起動せず設計だけ行う。

<!-- END:component-list -->
