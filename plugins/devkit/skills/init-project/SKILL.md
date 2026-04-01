---
name: init-project
description: This skill should be used when the user asks to "set up a project", "initialize a new app", "create a new project", "bootstrap a project", "set up my dev environment", or wants to start a new personal web application. Also use when the user says "init project", "new project", or wants to complement an existing project with missing tooling and configuration.
---

# Project Setup

Unified flow for creating new projects and complementing existing ones.

## Detection

1. Check if `package.json` exists in the current directory
2. **Does not exist** → New project flow
3. **Exists** → Complement setup flow

## New Project Flow

1. Ask the user for project name
2. Scaffold with `pnpm create next-app@latest <name> --ts --app --tailwind --src-dir --use-pnpm`
3. Set up pnpm workspace + Turborepo (see `devkit:standards` → `references/ecosystem.md`)
4. Install quality tooling (see `devkit:standards` → `references/quality-automation.md`)
5. Install backend dependencies (see `devkit:standards` → `references/backend.md`)
6. Generate AGENTS.md with project context

Refer to `devkit:standards` and its reference files for specific technology choices.

## Complement Setup Flow

1. Read techstack definitions from context (CLAUDE.md, AGENTS.md, etc.)
2. Check if tools from `devkit:standards` → `references/quality-automation.md` are installed
3. Install anything missing
4. Generate/update config files (confirm before overwriting existing files)

## Environment Variables

After project setup, set the following environment variable to enable additional constraints.

### DEVKIT_ENFORCE_TOOLS

Enforces tool usage in pnpm/tsgo environments. When set, the following commands are blocked:

| Blocked Command | Alternative |
| --------------- | ----------- |
| npx             | pnpx        |
| npm             | pnpm        |
| tsc             | tsgo        |

Add to the project's `.envrc`:

```bash
export DEVKIT_ENFORCE_TOOLS=1
```
