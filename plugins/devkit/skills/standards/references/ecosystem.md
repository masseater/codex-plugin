---
description: Foundation ecosystem — Node.js, pnpm, Turborepo, tsx, Bun, mise, and script execution policy
---

# Ecosystem Stack

Foundation ecosystem not tied to any specific tech stack (Web/Backend/CLI).

## Tools

| Tool                            | Role                                                      |
| ------------------------------- | --------------------------------------------------------- |
| Node.js (latest LTS or current) | Runtime                                                   |
| pnpm                            | Package manager                                           |
| tsx                             | TypeScript script runner (for project scripts)            |
| Turborepo                       | Monorepo task runner + remote cache                       |
| Bun                             | Runtime for non-project tooling (AI hooks, plugins, etc.) |

## Tool Version Management

Use [mise](https://mise.jdx.dev/) to manage tool versions. Create `.mise.toml` at the project root to pin Node.js, pnpm, and other CLI tools so all contributors (human and AI) use the same versions. Prefer `.mise.toml` over `.tool-versions` — it supports env vars, tasks, settings, and local overrides (`.mise.local.toml`).

```toml
# .mise.toml — use the latest version available at setup time
[tools]
node = "25.0.0"
pnpm = "10.12.1"
```

## Script Execution Policy

| Context                                          | Runner     | Why                                                                  |
| ------------------------------------------------ | ---------- | -------------------------------------------------------------------- |
| Project scripts (dev, build, test, migrations)   | pnpm + tsx | Part of the project dependency graph; reproducible via lockfile      |
| AI coding agent hooks, plugins, external tooling | Bun        | Not part of the project; independent runtime, no lockfile dependency |

Project scripts must be executable via `pnpm tsx <script>` or as package.json scripts. They must not depend on Bun APIs.

## Deployment

| Project type  | Deploy target      |
| ------------- | ------------------ |
| Next.js (web) | Vercel             |
| CLI tools     | npm publish        |
| Other         | Choose per project |

DB and storage are chosen per project — no default mandated. Evaluate based on project requirements (serverless compatibility, cost, data model fit).

## Monorepo

Use Turborepo for monorepo management with pnpm workspaces.

### Workspace Package References

Internal packages use the `@repo/` scope. Reference them in `package.json` with the `workspace:` protocol.

```jsonc
// package.json
{
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@repo/config": "workspace:*",
  },
}
```

```typescript
// Import from workspace packages
import { Button } from "@repo/ui";
import { envSchema } from "@repo/config";
```

### Package Layout

```
packages/
  ui/          → @repo/ui
  config/      → @repo/config
  db/          → @repo/db
apps/
  web/         → consumes @repo/*
  api/         → consumes @repo/*
```

Each package has its own `package.json` with `"name": "@repo/<name>"`. Shared types, components, and utilities live in `packages/`; deployable applications live in `apps/`.
