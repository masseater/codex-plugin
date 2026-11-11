# Review Comments Checker

Check unresolved review comments and fix them locally.

## Workflow

### Step 1: Get Unresolved Threads

```bash
../../github-pr/scripts/get-unresolved-threads.ts
```

Example output:

```json
{
  "owner": "user",
  "repo": "repo",
  "pr": 123,
  "threadIds": ["PRRT_abc123", "PRRT_def456"]
}
```

### Step 2: Get Comment Details for Each Thread

Run for each thread ID:

```bash
../../github-pr/scripts/get-comments-by-thread.ts --thread-id "PRRT_abc123"
```

Output includes file path (`path`), line number (`line`), and comment list (`comments`).

### Step 3: Present Summary

Organize all threads and present to the user:

- File path and line number
- Reviewer name
- Comment content (latest comment in thread)
- Thread URL

### Step 4: Fix Locally

Fix review comments directly in the local codebase. Do not reply or comment on the PR.

1. Open the relevant file for each comment and fix the issue
2. Only ask the user for confirmation when a fix seems unnecessary
3. Never post comments back to the PR

### Step 5: Verify Fixes

After all fixes are complete:

1. Run `git diff` to verify changes are correct
2. Report a summary of fixes to the user
