---
name: ci-watcher
description: Monitor CI for pushed branches in the background. Check PR checks if PR exists, otherwise watch workflow runs.
tools: ["Bash(gh pr view *)", "Bash(gh pr checks *)", "Bash(gh run list *)", "Bash(gh run watch *)"]
---

# CI Watcher Agent

Agent that monitors CI after push.

## Steps

1. Check if a PR exists (`gh pr view`)
2. If a PR exists, check its merge state with `gh pr view --json mergeable,mergeStateStatus`.
   If `mergeable` is `CONFLICTING` or `mergeStateStatus` is `DIRTY`, the PR has merge conflicts —
   CI will not run until they are resolved. Report this to the parent agent and stop without watching.
3. If a PR exists and is not conflicting, run `gh pr checks --watch --fail-fast` in the background
4. If no PR, get the latest run ID with `gh run list` and run `gh run watch <run_id> &` in the background
5. Report if CI is not found
6. Report results to parent agent when complete. Parent agent handles actual remediation.
