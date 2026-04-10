---
description: Documentation principles — what to put in a repository, what not to, and why tests/lint beat prose
---

# Documentation Principles

## Core Principle: Executable Artifacts Over Prose

Enforce standards through tests and lint rules, not documentation. Tests and lint rules are executable, self-verifying, and fail when violated. Documentation rots silently — and AI agents cannot distinguish stale docs from current truth.

## What to Put in a Repository

Put **executable artifacts** — things whose correctness is mechanically verifiable:

| Artifact              | Why                           |
| --------------------- | ----------------------------- |
| Code                  | Runs or doesn't               |
| Tests                 | Pass or fail                  |
| Lint rules and config | Enforce patterns mechanically |
| Type definitions      | Compiler verifies             |
| Schema definitions    | Validated at boundaries       |
| CI configuration      | Executes on every push        |

Also put **Architecture Decision Records (ADRs)** — records of decisions with timestamps and explicit status:

| ADR field    | Purpose                            |
| ------------ | ---------------------------------- |
| Date         | When the decision was made         |
| Status       | Accepted / Superseded / Deprecated |
| Context      | What problem was being solved      |
| Decision     | What was chosen                    |
| Consequences | What trade-offs were accepted      |

ADRs are never edited in place — they are superseded by new ADRs. This makes validity structurally determinable: an agent reads the status field, not the prose.

## What NOT to Put in a Repository

Do not commit prose that describes current system state:

- "The system currently works like this" explanations
- Hand-written API descriptions (generate from code or schema instead)
- Architecture overview text (derive from code structure or ADRs instead)
- Design documents that describe implementation (the code IS the implementation)

These documents inevitably fall behind the code. When they do, AI agents treat the stale information as ground truth — there is no mechanism to detect the drift.

**Stale context actively degrades AI performance.** Research shows all frontier models degrade as context length increases with irrelevant or outdated information. Every stale document in the repository is noise that competes with signal.

## Decision Hierarchy

When you want to enforce a standard or convention, choose the mechanism in this order:

| Priority | Mechanism                        | Why                                                                                                   |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1        | Type system                      | Compile-time guarantee, zero runtime cost                                                             |
| 2        | Lint rule (oxlint/ESLint plugin) | Runs with every check, reports file:line, supports --fix                                              |
| 3        | Test                             | Runs in CI, catches regressions, documents behavior through assertions                                |
| 4        | Schema validation                | Runtime boundary enforcement (env vars, API inputs, config)                                           |
| 5        | CI check                         | Catches what lint and tests miss (build output, bundle size, deploy config)                           |
| 6        | ADR                              | Records WHY a decision was made — not how the system works                                            |
| 7        | Generated documentation          | Auto-derived from code (JSDoc, OpenAPI, type exports). Acceptable because regeneration prevents drift |
| 8        | Prose documentation              | Last resort. Only for onboarding context that cannot be expressed any other way                       |

If you reach for prose documentation, first ask: "Can this be a type, a lint rule, a test, or a schema instead?"

## When Prose Documentation IS Acceptable

- **Onboarding guides** that explain how to get started (but prefer scripts that automate the setup)
- **AGENTS.md / CLAUDE.md** that configure AI agent behavior (these are effectively "configuration as prose")
- **README.md** with project purpose and quick-start commands (keep minimal)
- **ADRs** (see above — structured, timestamped, status-tracked)

Even these must follow the auto-generation principle: derive lists, tables, and inventories from code rather than hand-maintaining them.

## Project-Specific Intentional Violations

When a repository intentionally deviates from devkit standards, record the deviation in `docs/devkit-intentional-violation.md`.

Requirements:

- Keep the file in the repository so the decision travels with the code
- Record the violated rule, affected scope/file when useful, the reason, and the latest review date in plain Markdown
- Update or delete the entry when the deviation no longer applies

Example:

```md
# Devkit Intentional Violations

## ecosystem/bun-runtime

- Scope: `(root)`
- File: `package.json`
- Reason: This repository intentionally uses Bun because it ships Claude Code plugins that must stay independent from the target project's toolchain.
- Reviewed: 2026-04-04
```
