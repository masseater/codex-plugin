---
name: code-review:check-pr
description: Check PR status and take action. Use when checking PR review comments, analyzing CI failures, or responding to check-pr requests.
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
