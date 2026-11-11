# CI Status Checker

Check CI status and analyze failures to determine a fix strategy.

## Workflow

### Step 1: Get CI Status

```bash
../../github-pr/scripts/get-ci-status.ts
```

Output includes `overallStatus` (success / failure / pending / neutral) and details for each check.

To check a specific check:

```bash
../../github-pr/scripts/get-ci-status.ts --name "build"
```

### Step 2: Evaluate Status

- `success` / `neutral`: Report and done.
- `pending`: Report which checks are running.
- `failure`: Proceed to Step 3.

### Step 3: Download Failure Logs

```bash
../../github-pr/scripts/get-ci-logs.ts
```

By default, only failed check logs are downloaded.

To download all check logs:

```bash
../../github-pr/scripts/get-ci-logs.ts --all
```

To download logs for a specific check:

```bash
../../github-pr/scripts/get-ci-logs.ts --name "build"
```

To specify output directory:

```bash
../../github-pr/scripts/get-ci-logs.ts --output-dir ./my-logs
```

### Step 4: Analyze Logs

Read downloaded log files and identify:

- Error messages and stack traces
- Failed test names
- Build errors
- Configuration issues

### Step 5: Fix Locally

Fix the identified errors directly in the local codebase:

- Fix each error in the relevant file
- Run `git diff` to verify changes are correct
- Report a summary of fixes to the user
