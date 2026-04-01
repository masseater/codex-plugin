---
description: Parallel development with git worktrees — automated setup, environment isolation, and dynamic port allocation
---

# Parallel Development

Requirements for supporting git-worktree-based parallel development. Every project must be designed so that multiple worktrees can run side-by-side without conflicts.

## Principle

A fresh worktree must be ready to develop within a single automated step. Manual setup steps (install dependencies, copy env files, configure ports) are bugs — automate them or they will be forgotten.

## Worktree Bootstrap Script

Provide a `worktree:setup` script that runs automatically when a new worktree is created. This script must handle all setup required to make the worktree development-ready.

```jsonc
// package.json
{
  "scripts": {
    "worktree:setup": "tsx scripts/worktree-setup.ts",
  },
}
```

The script must perform at minimum:

| Step                         | What                                                                 | Why                                                |
| ---------------------------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Install dependencies         | `pnpm install`                                                       | Worktrees share git objects but not `node_modules` |
| Copy environment files       | Copy `.env.local` (and other `.env*.local` files) from main worktree | Secrets and local config are not tracked in git    |
| Generate dynamic port config | Write port assignments to `.env.local` or a local config file        | Prevent port collisions between worktrees          |
| Run codegen / DB setup       | Prisma generate, migrations, etc.                                    | Generated files may not exist in the new worktree  |

## Environment File Isolation

Worktrees must not share environment files via symlinks. Each worktree gets its own copy so that port overrides and other local changes do not affect other worktrees.

The bootstrap script copies `.env*.local` files from the source worktree (the main worktree or the worktree that triggered the creation). After copying, it patches port-related variables to avoid collisions.

```typescript
// scripts/worktree-setup.ts — conceptual example
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const mainWorktree = getMainWorktreePath(); // e.g., from `git worktree list`
const envFiles = [".env.local", ".env.development.local"];

for (const file of envFiles) {
  const src = resolve(mainWorktree, file);
  if (existsSync(src)) {
    copyFileSync(src, resolve(process.cwd(), file));
  }
}
```

## Dynamic Port Allocation

When a project runs a dev server (Next.js, Vite, Hono, etc.), the port must be configurable via environment variable so that multiple worktrees can run simultaneously.

### Requirements

- The dev server must accept a port via `PORT` environment variable (or framework-specific equivalent like `--port`)
- The bootstrap script assigns a unique port per worktree and writes it to `.env.local`
- Port assignment strategy: base port + offset derived from worktree name or index

```typescript
// Port allocation — conceptual example
import { execFileSync } from "node:child_process";

const BASE_PORT = 3000;
const output = execFileSync("git", ["worktree", "list", "--porcelain"], { encoding: "utf-8" });
const worktreeCount = output.split("worktree ").length - 1;
const port = BASE_PORT + (worktreeCount - 1) * 10; // 3000, 3010, 3020, ...

// Write to .env.local
appendToEnvLocal(`PORT=${port}`);
```

### Dev Server Configuration

Frameworks must read the port from the environment, not hardcode it:

```jsonc
// package.json
{
  "scripts": {
    "dev": "next dev --port ${PORT:-3000}",
  },
}
```

## Dependency Installation

Worktrees share the `.git` directory but have independent working trees. `node_modules` is not shared and must be installed in each worktree.

The bootstrap script must:

- Run `pnpm install` (or the project's package manager)
- Run any post-install codegen (`prisma generate`, GraphQL codegen, etc.)
- Verify that the lockfile matches (no `--no-frozen-lockfile` in worktrees)

## AI Agent Integration

When AI coding agents (Claude Code, etc.) create worktrees via tools like `gwq` or `EnterWorktree`, the bootstrap script should be triggered automatically. Configure this via:

- A git hook (`post-checkout` with worktree detection)
- Or explicit invocation in the agent's worktree creation workflow

The agent must be able to run `pnpm run worktree:setup` and have a fully functional development environment without further manual steps.

## Checklist for Worktree Readiness

A project is worktree-ready when:

- [ ] `pnpm run worktree:setup` exists and performs full bootstrap
- [ ] Dev server port is configurable via environment variable
- [ ] `.env*.local` files are copied and patched automatically
- [ ] Dependencies install cleanly in a fresh worktree
- [ ] Codegen / migrations run as part of setup
- [ ] Multiple worktrees can run dev servers simultaneously without port collisions
