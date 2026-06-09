# devkit

この plugin 配下の変更は Auto Version Bump workflow の patch bump 対象である。
Development toolkit — tech stack definitions, project setup, and quality automation.

## Model Invocation Policy

<!-- BEGIN:model-invocation-policy -->

以下の skill は `disable-model-invocation: true` を付与しない。設計判断: ユーザーが自然文で依頼する主要ワークフロー、または AI がタスク遂行中に自律参照すべき実行リファレンスである。これらの `description` には自然文 trigger、または実行リファレンスとしての参照理由を定義する。

- `devkit:cli-compliance`
- `devkit:init-project`
- `devkit:standards`
- `devkit:standards-audit`

上記以外の skill は、明示呼び出し・内部参照・手動操作・低レベルユーティリティとして扱い、`disable-model-invocation: true` を維持する。disabled skill の `description` には広い自然文 trigger を定義しない。

<!-- END:model-invocation-policy -->

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name                   | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | devkit:cli-compliance  | This skill should be used when the user asks to "check CLI compliance", "validate CLI tool", "audit CLI code", "review CLI conventions", or wants to verify a CLI tool follows tech stack standards. Also use when the user says "check if this script follows our standards" or "lint this CLI tool".                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| skill | devkit:init-project    | This skill should be used when the user asks to "set up a project", "initialize a new app", "create a new project", "bootstrap a project", "set up my dev environment", or wants to start a new personal web application. Also use when the user says "init project", "new project", or wants to complement an existing project with missing tooling and configuration.                                                                                                                                                                                                                                                                                                                                                                                    |
| skill | devkit:standards       | This skill should be used when the user asks to "set up a project", "choose a tech stack", "establish coding standards", "configure linting", "set up tests", "pick a framework", "review code quality", "set up logging", "configure observability", "choose an ORM", "set up auth", "set up Storybook", "write stories", "visual testing", "CSF", "coverage threshold", or discusses any technology choices for a TypeScript project. Also use when starting a new project, setting up CI/CD, choosing between tools (oxlint vs ESLint, pnpm vs npm), configuring environment variables, or when any other devkit skill needs to reference project conventions. This is the central reference for all devkit technology decisions and coding principles. |
| skill | devkit:standards-audit | This skill should be used when the user asks to "audit project standards", "check standards compliance", "devkit audit", "find standards violations", "are we following devkit standards", "what's not following standards", "compliance report", "規約チェック", "スタンダード監査", or "規約違反を探して". It actively scans code and reports violations. Do NOT use for project scaffolding (use init-project), single-CLI-tool checks (use cli-compliance), or looking up what the standards are (use standards).                                                                                                                                                                                                                                      |
| agent | standards-auditor      | Audit a single project scope against a single devkit standards reference. Reports violations and recommendations as structured JSON. Used by the standards-audit skill.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| hook  | block-deny-command     | PreToolUse (`Bash`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| hook  | standards-audit        | Stop                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

<!-- END:component-list -->

## Notes

- block-deny-command hook is only active when DEVKIT_ENFORCE_TOOLS environment variable is set
- standards-audit hook is only active when DEVKIT_AUDIT_ON_STOP environment variable is set
