---
description: "GitHub API guidelines: use gh auth token + Octokit instead of gh CLI directly"
---

# GitHub API Usage Guidelines

## Principle: Octokit First, gh CLI Last

Use `gh auth token` to obtain an authentication token and interact with the GitHub API via Octokit. Do NOT call `gh` CLI directly for API operations.

Before resorting to `gh` CLI, first investigate whether the operation is possible via Octokit. Only after confirming that Octokit genuinely cannot accomplish the task should `gh` CLI be used directly.

## Why

- `gh` CLI output varies across versions and environments, making parse-dependent scripts fragile
- Octokit returns typed, structured responses that enable robust scripting
- Octokit handles error handling, pagination, and rate limiting properly
- `gh auth token` requires no additional auth configuration

## Token Acquisition

```typescript
import { execFileSync } from "node:child_process";

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim();
```

Always use `execFileSync` (not `execSync`) to avoid shell injection risks.

## Octokit Usage

```typescript
import { execFileSync } from "node:child_process";
import { Octokit } from "@octokit/rest";

const token = execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim();
const octokit = new Octokit({ auth: token });

// Example: Get PR details
const { data: pr } = await octokit.pulls.get({
  owner: "org",
  repo: "repo",
  pull_number: 123,
});
```

## Anti-patterns

| Anti-pattern                                  | Better approach                            |
| --------------------------------------------- | ------------------------------------------ |
| `gh api /repos/...` for API calls             | Use Octokit's typed methods                |
| Parsing `gh pr list` output with grep/awk     | `octokit.pulls.list()` for structured data |
| Parsing `gh issue list --json` JSON output    | Fetch directly via Octokit                 |
| Calling `gh pr comment` repeatedly in scripts | `octokit.issues.createComment()` in a loop |
