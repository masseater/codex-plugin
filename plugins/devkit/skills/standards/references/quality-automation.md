---
description: Quality automation tools — oxlint, ESLint custom plugins, oxfmt, steiger, tsgo, knip, lefthook, Renovate, CI required checks, claude-code-action auto-fix, and automation-as-lint policy
---

# Quality Automation

Concrete tools that realize "make everything mechanically detectable" from philosophy.

## Core Principle: Automation = Lint Rule, Not Script

**When automating checks, write oxlint/ESLint custom plugins — not standalone scripts.**

- Scripts get forgotten. Lint rules run alongside everything else via `pnpm run check`
- Same checks run in CI, lefthook, editors, and AI agents — no separate execution step
- Violations are reported with file name and line number (no stdout parsing needed)
- Add `--fix` support for automatic remediation

When you think "I want to detect this pattern," first consider whether it can be a lint rule.

## Tools

| Tool                  | Role                                                               |
| --------------------- | ------------------------------------------------------------------ |
| oxlint                | Primary linter (oxc-based, 10-100x faster than ESLint)             |
| oxfmt                 | Formatting (oxc-based, fast)                                       |
| ESLint (v9+)          | Custom rules, type-aware rules, architectural boundary enforcement |
| steiger               | FSD architecture linting                                           |
| tsgo (TypeScript v7+) | Type checking                                                      |
| knip                  | Unused code detection                                              |
| lefthook              | Git hooks management                                               |
| Renovate              | Automated dependency updates                                       |

## oxfmt — Formatting (Root Execution)

oxfmt is the formatter for the entire monorepo. **Run at the monorepo root only** — not per-workspace.

```jsonc
// package.json (monorepo root)
{
  "scripts": {
    "check": "rtk eslint && rtk oxfmt --check . && turbo run check",
    "check:fix": "eslint --fix && oxfmt . && turbo run check:fix",
  },
}
```

Why root-only:

- Formatting rules are uniform across the entire monorepo — workspace-level divergence is not allowed
- Running at root avoids duplicate invocations and ensures consistent formatting of shared files (root configs, scripts, etc.)
- Workspace `check` scripts handle linting only; formatting is the root's responsibility

## oxlint — Use for All General Linting

Use oxlint as the primary linter. It provides 700+ built-in rules in Rust (50-100x faster than ESLint) with zero configuration.

Enable categories based on project needs:

| Category    | Description                        | Default   |
| ----------- | ---------------------------------- | --------- |
| correctness | Outright wrong or useless code     | warn/deny |
| suspicious  | Most likely wrong or useless       | warn      |
| perf        | Can be written to run faster       | warn      |
| style       | Naming and code style conventions  | allow     |
| pedantic    | Style or best-practice enforcement | allow     |
| restriction | Restricts certain syntax/patterns  | allow     |
| nursery     | Experimental rules                 | allow     |

Write project-specific rules as oxlint JS plugins (ESLint v9+ API compatible, alpha stability). Configure via `jsPlugins` in `oxlint.config.ts`. Many ESLint plugins work without modification — test each one before relying on it.

Do not use oxlint for type-aware rules (use ESLint + typescript-eslint instead).

### Monorepo Config Strategy

Run oxlint per-workspace via turbo. Inherit settings from the shared `@repo/lint-config` package (shared with ESLint, see below).

Each workspace's `oxlint.config.ts` imports `{ oxlintBase }` from `@repo/lint-config` and extends it. Always place a config even when the base is sufficient — turbo runs per-workspace.

## ESLint — Use for Type-Aware and Architectural Rules

Use ESLint alongside oxlint when you need capabilities oxlint cannot provide:

| Use ESLint for                | How                                                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Type-aware rules              | Add typescript-eslint with typed linting (no-floating-promises, no-unsafe-\*, etc.)                               |
| Architectural boundaries      | Add eslint-plugin-boundaries to enforce FSD layer import constraints                                              |
| Import policy                 | Add eslint-plugin-import-x for circular dependency detection and import ordering                                  |
| Project-specific domain rules | Write local custom plugins — create a `.ts` file in the repo and import it in `eslint.config.ts` (no npm publish) |
| TanStack Query best practices | Add @tanstack/eslint-plugin-query                                                                                 |

Implement `fix()` in custom rules for automatic remediation via `--fix`.

### Monorepo Config Strategy

ESLint also inherits from `@repo/lint-config`, same as oxlint.

**Root vs Workspace responsibilities**:

| Level                        | ESLint scope                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Root `eslint.config.ts`      | Repository-wide structural rules (JSON lint: plugin.json, hooks.json, package.json custom rules, etc.) |
| Workspace `eslint.config.ts` | TypeScript/TSX type-aware rules, architectural boundaries, domain-specific rules                       |

Root ESLint handles repository structure lint (JSON files, etc.). Workspace ESLint runs per-workspace via turbo.

Each workspace's `eslint.config.ts` imports `{ eslintBase }` from `@repo/lint-config` and spreads it. Always place a config even when the base is sufficient — turbo runs per-workspace.

## When to Use Which

| Need                               | Use                                                | Why                                                  |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| General correctness/style checks   | oxlint                                             | Fast, zero-config, 700+ built-in rules               |
| Project-specific AST rules         | oxlint JS plugin first, ESLint if stability needed | oxlint plugin API is alpha but ESLint v9+ compatible |
| Rules requiring type information   | ESLint + typescript-eslint                         | oxlint does not support type-aware linting           |
| Architectural boundary enforcement | ESLint + eslint-plugin-boundaries                  | Layer-level import constraints                       |
| Circular dependency detection      | oxlint (import/no-cycle) or ESLint                 | oxlint uses module graph — no performance penalty    |

## Vitest Test File Restrictions

Use `@vitest/eslint-plugin` with the `strict` preset as the baseline, then layer project-specific restrictions on top (see `references/test.md` for full rationale). Apply only to test files.

```typescript
// eslint.config.ts
import vitest from "@vitest/eslint-plugin";

export default [
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    extends: [vitest.configs.strict],
    rules: {
      "vitest/no-restricted-matchers": [
        "error",
        {
          toBeTruthy: "Use `toBe(true)` or a more specific matcher",
          toBeFalsy: "Use `toBe(false)` or a more specific matcher",
          toBeDefined: "Assert the specific expected value instead",
        },
      ],
      "vitest/no-hooks": "error",
    },
  },
];
```

`let` ban in test files: `vitest/no-hooks` removes the main motivation for `let` (the `let x; beforeEach(() => { x = ... })` pattern). Enforce `let` prohibition by convention and code review — do not use `no-restricted-syntax` (see Prohibited ESLint Rules below).

## Prohibited ESLint Rules

| Rule                    | Why prohibited                                                                                                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `no-restricted-imports` | ESLint flat config merges arrays per key — if multiple config entries define `no-restricted-imports`, only the last one takes effect. Restrictions silently disappear. Use `eslint-plugin-import-x` rules or custom plugins instead |
| `no-restricted-syntax`  | Same flat config merge problem as `no-restricted-imports`. Write a local custom plugin instead                                                                                                                                      |

## Custom Rule: enforce-barrel-import

Enforce that imports go through `index.ts` when one exists. Write as a local ESLint custom plugin.

**Logic**: resolve the import path → walk up to find the nearest directory → if that directory contains `index.ts` (or `index.tsx`) but the import points at a deeper file → error.

```
src/shared/api/fuga/index.ts  exists
src/shared/api/fuga/client.ts exists
src/shared/api/hoge.ts        exists (no index.ts in parent)

import { x } from "@/shared/api/fuga/client"  // NG — index.ts exists, use "@/shared/api/fuga"
import { x } from "@/shared/api/fuga"          // OK — barrel import
import { x } from "@/shared/api/hoge"          // OK — no index.ts in parent, direct import allowed
```

This rule replaces `fsd/public-api` for `shared/` where the standard FSD rule is too strict (requires index.ts in every directory).

## Lint/Format Policy

- Use oxlint + oxfmt by default (oxc ecosystem)
- Write custom rules as oxlint JS plugins first. Fall back to ESLint custom plugins when type-aware analysis or stability is required
- When running both, use `eslint-plugin-oxlint` to disable overlapping rules
- Place local plugins as `.ts` files in the repository (no npm publish required)
- **Never write a standalone script for something a lint rule can do** — lint rules are discoverable, composable, and run everywhere

### `@repo/lint-config` — Shared Config Package

Combine oxlint and ESLint base configs into a single package. Exports `oxlintBase` and `eslintBase` for workspaces to import.

```
packages/
  lint-config/                → @repo/lint-config
    oxlint.config.ts          → oxlint base (categories, rules, ignorePatterns)
    eslint.ts                 → ESLint base (typescript-eslint, eslint-plugin-oxlint)
    index.ts                  → re-export: { oxlintBase, eslintBase }
```

### Monorepo Execution Model

| Tool                     | Execution level       | Rationale                                                                                     |
| ------------------------ | --------------------- | --------------------------------------------------------------------------------------------- |
| oxfmt                    | Root only             | Formatting is uniform across the monorepo — no reason for per-workspace divergence            |
| oxlint                   | Per-workspace (turbo) | Rules may differ per workspace. Common base inherited from `@repo/lint-config`                |
| ESLint (code)            | Per-workspace (turbo) | Type-aware rules depend on workspace tsconfig. Common base inherited from `@repo/lint-config` |
| ESLint (JSON/structural) | Root                  | Repository structure custom rules (plugin.json, hooks.json, etc.) run once at root            |

## Tool Invocation Policy

When defining hooks (lefthook, Claude Code hooks) or CI scripts, never call node_modules binaries directly. Always wrap them in package.json scripts and call those instead.

**rtk prefix**: All tool invocations in package.json scripts must use `rtk` (CLI output proxy). rtk reduces output size by 60-90%, benefiting AI agents and CI logs alike. No need for separate human-only / AI-only commands — rtk output is human-readable too.

```jsonc
// package.json (workspace)
{
  "scripts": {
    "check": "rtk oxlint",
    "check:fix": "oxlint --fix",
    "typecheck": "rtk tsgo --noEmit",
    "test": "rtk vitest run",
  },
}
```

```jsonc
// package.json (monorepo root)
{
  "scripts": {
    "check": "rtk eslint && rtk oxfmt --check . && turbo run check",
    "check:fix": "eslint --fix && oxfmt . && turbo run check:fix",
    "typecheck": "turbo run typecheck",
  },
}
```

```yaml
# lefthook.yml — OK
pre-commit:
  commands:
    check:
      run: pnpm run check

# lefthook.yml — NG
pre-commit:
  commands:
    check:
      run: npx oxlint && npx oxfmt --check
```

Why:

- Single source of truth for how each tool is invoked (flags, config paths, order)
- Discoverable — `pnpm run` lists all available commands
- Consistent across lefthook, CI, Claude Code hooks, and manual runs
- rtk prefix ensures all consumers get compressed output automatically

## CI Pipeline — Required Checks

Every PR and push to main must pass the following checks. These are non-optional and must be configured as required status checks in the repository's branch protection rules:

| Check                 | Command                  | Purpose                                                                                |
| --------------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| Lint + Format         | `pnpm run check`         | Root: ESLint (JSON) + oxfmt → Turbo: oxlint + ESLint (code) per workspace              |
| Type check            | `pnpm run typecheck`     | Ensure type safety across the codebase                                                 |
| Test with coverage    | `pnpm run test:coverage` | Verify behavior and enforce coverage thresholds (includes Storybook interaction tests) |
| Unused code detection | `pnpm run knip`          | Prevent dead code from accumulating                                                    |

All four checks must pass before a PR can merge. No exceptions, no manual overrides. If a check is flaky, fix the flakiness — do not skip the check.

## AI Coding Agent Hooks

See `references/ai-harness.md` for Hook feedback loop design, error messages as fix instructions, and AGENTS.md design principles.

- Use the `claude-automation-recommender` skill to analyze a codebase and recommend which hooks, subagents, and automations to set up

## Dependency Updates — Renovate

Use Renovate for automated dependency updates. Keep dependencies current to reduce security exposure and prevent accumulation of large, risky upgrades.

### Automerge Policy

Enable automerge for updates where CI provides sufficient confidence:

| Update type                | Automerge | Rationale                                                                              |
| -------------------------- | --------- | -------------------------------------------------------------------------------------- |
| Patch versions (x.x.PATCH) | Yes       | Bug fixes and security patches with low risk. CI passing is sufficient                 |
| Minor versions (x.MINOR.x) | Yes       | New features with backward compatibility. If tests and type checks pass, safe to merge |
| Major versions (MAJOR.x.x) | No        | Breaking changes require manual review of migration guides and changelog               |
| lockfile-only updates      | Yes       | No code change — only lockfile resolution updates                                      |

### Grouping

Group related packages into a single PR to reduce noise and ensure compatible versions ship together. Group by ecosystem or org scope (e.g., all `@tanstack/*` packages in one PR, all `eslint-*` packages in one PR).

### CI as the Merge Gate

Automerge relies on CI catching regressions. The CI pipeline must include lint, type check, and test stages. If CI is insufficient to catch breakage for a given package, disable automerge for that package and review manually.

### PR Limit

Set the concurrent PR limit to 10. This caps the number of open Renovate PRs at any given time, preventing PR flood while keeping updates flowing steadily.

### Update Schedule

Configure a maintenance window that avoids deploying dependency updates during active development. Run updates on a schedule (e.g., weekends or early morning) to batch PRs and avoid mid-sprint disruption.

## Auto-Fix on Main Failure — Claude Code Action

Create a GitHub Action that automatically fixes CI failures on main using claude-code-action with OAuth authentication. When a push to main fails CI, the action triggers Claude Code to read the failure logs, diagnose the issue, and push a fix commit directly to main.

This creates a self-healing loop: CI catches the regression, Claude Code fixes it, and CI verifies the fix — all without human intervention. OAuth authentication (not API keys) ensures the action runs with proper scoped permissions and audit trail.

The action should only trigger on main branch CI failures, not on PRs. PR failures are the author's responsibility to fix.

## Automated Documentation

### JSDoc — Type-level analysis with mandatory lint

- Require JSDoc on all exported symbols; missing JSDoc is a lint error
- Cross-check `@param` and `@returns` against TypeScript type information; contradictions are also errors
- Analyze JSDoc `@` tags at the type/AST level, not via text matching

### Markdown — Mandatory YAML frontmatter

- Require YAML frontmatter in project Markdown files (README.md, AGENTS.md, etc.)
- Define metadata such as `name` and `description` in frontmatter so it can be collected mechanically

### Monorepo Root AGENTS.md — Auto-collected lists

- Never hand-write app/package lists in the root AGENTS.md
- Auto-collect from each app/package's frontmatter (or package.json `name` + `description`)
- Use marker comments (`<!-- BEGIN:xxx -->` / `<!-- END:xxx -->`) to auto-replace sections
