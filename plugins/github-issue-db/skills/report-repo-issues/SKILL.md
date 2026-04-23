---
name: report-repo-issues
description: End-to-end triage — investigate the repo, dedupe against the local issue DB, and for each finding either comment on an existing issue or create a new one. Use when the user says "課題を洗い出してissue化", "リポジトリを調査してissueにする", "report repo issues", "investigate and file issues", "問題を見つけてGitHubに上げる", or wants an end-to-end flow from code to GitHub.
---

# Report Repository Issues (End-to-End)

Compose `mutils:investigate-repo` + `github-issue-db:search-similar-issues` + `github-workflow:create-issue` + `github-issue-db:update-existing-issues` into a single triage pass.

For each real finding:

- open `high` match → comment via `update-existing-issues`
- closed `high` match → ask user whether to reopen, or create new with `Related: #<n>`
- `medium` match → create with `Related: #<n>`
- no match → create

Never acts without user approval.

## Input

Optional scope:

- Target path/plugin/package (passed to `investigate-repo`)
- Severity floor (default `medium`)
- `dryRun`

## Output

```json
{
  "scope": "...",
  "findings_total": 7,
  "actions": [
    { "finding_id": "...", "action": "comment", "issue_number": 42, "url": "..." },
    { "finding_id": "...", "action": "create", "issue_number": 57, "url": "..." },
    { "finding_id": "...", "action": "skip", "reason": "severity below floor" }
  ]
}
```

## Workflow

### Step 1: Sync the Cache

```bash
../../scripts/sync.ts
```

One sync covers every downstream search.

### Step 2: Investigate

Invoke `mutils:investigate-repo`. Capture the JSON findings block. If empty → report and stop.

### Step 3: Filter by Severity

Drop findings below the floor.

### Step 4: Dedupe Per Finding

For each finding, invoke `github-issue-db:search-similar-issues`. Collect `recommendation` + top candidate.

### Step 5: Build Action Plan

| similar-issues recommendation | Action                                                 |
| ----------------------------- | ------------------------------------------------------ |
| `duplicate` (open)            | `comment` via `github-issue-db:update-existing-issues` |
| `duplicate` (closed)          | ask user: reopen vs create+cross-link                  |
| `related`                     | `create` with `Related: #<n>`                          |
| `no-match`                    | `create`                                               |

Render as:

```markdown
| #   | Finding | Action  | Target               |
| --- | ------- | ------- | -------------------- |
| 1   | <title> | comment | #42 <existing title> |
| 2   | <title> | create  | —                    |
```

### Step 6: Confirm with User

`AskUserQuestion`: approve-all / edit-per-finding / cancel. For individual tweaks, drop into per-finding edit.

### Step 7: Execute

- `comment` → `github-issue-db:update-existing-issues` on the single target
- `create` → `github-workflow:create-issue` with the finding (pass user edits)
- `reopen-or-create` → prompt; default to `create` + `Related: #<closed>`

Batches of 1–5 can run in parallel. Batches > 5 run sequentially.

### Step 8: Summarize

Emit the JSON contract + a short summary (created count + issue numbers, commented count + issue numbers, skipped count).

## Rules

- Cap at 10 new issues per run; more → batch with user approval
- Reject findings that lack `evidence`
- User dialog in 日本語; issue content in English
- When an existing issue is stale (> 90 days since update), flag it in the plan so the user can choose between comment and re-file
