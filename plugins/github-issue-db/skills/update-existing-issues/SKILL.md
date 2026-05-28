---
name: github-issue-db:update-existing-issues
description: Verify selected GitHub issues against the current repository state using the local issue DB, post status comments, and — with explicit approval — close resolved ones. Use when the user says "既存issueを更新", "issueの状態を確認", "update existing issues", "issue triage", "古いissueをcloseする", or wants to refresh stale issues with the latest repo reality.
---

# Update Existing Issues

Verify a SELECTED set of GitHub issues against the current repo, comment status, and close when safe. Never walks "all open issues" — real repos have thousands. The user must narrow scope.

## Input Contract

One of these selectors is required:

- `numbers`: explicit issue numbers
- `label`: label name(s), AND semantics
- `updatedSince`: ISO date or relative ("30d ago")
- `authoredBy`: GitHub username
- `mentions`: substring match on title/body (uses the local DB)

Modifiers:

- `states`: `open` (default) | `all`
- `maxToProcess`: default `20`; `>50` requires a second confirmation
- `dryRun`: default `false`

Missing selector → `AskUserQuestion`. Never fall back to "all".

## Output Contract

```json
{
  "scope": "<selector summary>",
  "considered": 42,
  "processed": [
    {
      "number": 42,
      "url": "...",
      "verdict": "reproduces" | "partially-resolved" | "resolved" | "not-verifiable",
      "comment_url": "...",
      "closed": false,
      "skipped_reason": null
    }
  ]
}
```

## Workflow

### Step 1: Sync the Cache

```bash
../../scripts/sync.ts
```

Fresh data is required for verdicts to be meaningful.

### Step 2: Resolve Selector → Candidate List

Use the dedicated list script — all selector resolution goes through it:

```bash
../../scripts/list.ts \
  [--label <a>,<b>] \
  [--updated-since <ISO8601>] \
  [--authored-by <user>] \
  [--numbers <n1>,<n2>] \
  [--state open|closed|all] \
  [--limit <N>]
```

Selector mapping:

- `numbers` → `--numbers 42,57`
- `label` → `--label bug,confirmed` (comma = AND semantics, matched against `labels_json` via `LIKE '%"<label>"%'` — exact label name only, no prefix)
- `updatedSince` → `--updated-since 2026-01-01T00:00:00Z`
- `authoredBy` → `--authored-by someone`
- `mentions` → `scripts/search.ts "<mention>"` instead (FTS5 full-text, not a metadata filter)

Set `--limit` to `maxToProcess * 2` for headroom, then present to the user for confirmation if > `maxToProcess`.

For `mentions`, fall back to `scripts/search.ts` which runs the FTS5 trigram search described in `search-similar-issues`.

### Step 3: Per-Issue Verification (parallel batches of ≤ 3)

For each issue:

1. Read body + comment previews via `scripts/show.ts <number>` (from cache — no extra API calls)
2. Extract reproduction claims (paths, symbols, commands)
3. Verify against the checkout:
   - `Read` cited files
   - `Grep` cited symbols
   - Re-run the minimal reproduction (`bun run check`, `bun run typecheck`, targeted test)
4. Classify:
   - `reproduces` — evidence + symptom confirmed
   - `partially-resolved` — some evidence gone
   - `resolved` — no evidence remains, symptom gone
   - `not-verifiable` — cannot reproduce from issue text

Record `git rev-parse --short HEAD` once per run.

Skip gracefully when:

- Last 3 comments contain `<!-- posted by github-issue-db:update-existing-issues -->` within 24h
- Issue has `do-not-touch` / `wontfix` label
- Human-updated in the last hour (race risk)

### Step 4: Draft Comments

```markdown
## Status Update — `COMMIT_SHA`

<verdict line>

### Checked

- `path/to/file.ts:42` — present | removed | changed
- <command> — <result>

### Notes

<short paragraph>

<!-- posted by github-issue-db:update-existing-issues -->
```

Keep < 2500 chars. Use permalinks (`blob/<sha>/<path>#L<line>`), not full quotes.

### Step 5: Decide Closure

| Verdict              | Action                                                |
| -------------------- | ----------------------------------------------------- |
| `resolved`           | Recommend close, explicit per-issue or batch approval |
| `partially-resolved` | Comment only                                          |
| `reproduces`         | Comment only (+ optional `confirmed` label)           |
| `not-verifiable`     | Comment "needs repro" (+ optional `needs-repro`)      |

### Step 6: Plan → Confirm

```markdown
| #   | Title | Verdict | Action | Marker | Note |
| --- | ----- | ------- | ------ | ------ | ---- |
```

`AskUserQuestion`: approve-all / per-close-review / edit-per-issue / exclude / dry-run.

### Step 7: Execute

- Comment — Octokit `issues.createComment`, fallback `gh issue comment <n> --body-file "$(mktemp)"`
- Close — Octokit `issues.update({ state: "closed", state_reason: "completed" })`
- `state_reason: "not_planned"` only for explicit dismissal

Back off when `x-ratelimit-remaining` < 10.

### Step 8: Summarize

Emit the JSON contract + Markdown summary (counts per verdict, counts per action, skipped list with reasons).

## Rules

- Selector mandatory — no selector → ask
- Every comment cites the commit SHA
- Never close without user approval
- Never re-comment within 24h (check marker first)
- Honor opt-out labels (`do-not-touch`, `wontfix`, ...)
- Cap at `maxToProcess`; `>50` needs second confirmation
- Comments in English; user dialog in 日本語
- All verification reads come from the local cache or the checkout — do not hit GitHub per issue
