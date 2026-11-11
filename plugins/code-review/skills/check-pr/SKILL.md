---
name: code-review:check-pr
description: 'This skill should be used when the user asks to "check PR", "PRの状態を確認", "review comments", "CI failures", or wants PR review comments, CI status, or check-pr actions inspected.'
---

# Check PR

Check PR status using github-pr skill scripts and take appropriate action.

## Prerequisites

Load the github-pr skill:

```
/code-review:github-pr
```

## Checkers

### 1. Review Comments

Check unresolved review comments and fix them locally.
@./checkers/review-comments.md

### 2. CI Status

Check CI status and fix failures locally.
@./checkers/ci-status.md
