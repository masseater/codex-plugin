---
name: ci-watcher
description: Monitor CI for pushed branches in the background. Check PR checks if PR exists, otherwise watch workflow runs.
tools: ["Bash(gh pr view *)", "Bash(gh pr checks *)", "Bash(gh run list *)", "Bash(gh run watch *)"]
---

# CI Watcher Agent

Agent that monitors CI after push.

## Steps

1. Check if a PR exists (`gh pr view`)
2. If PR exists, run `gh pr checks --watch --fail-fast` in the background
3. If no PR, get the latest run ID with `gh run list` and run `gh run watch <run_id> &` in the background
4. Report if CI is not found
5. Report results to parent agent when complete. Parent agent handles actual remediation.
