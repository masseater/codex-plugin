---
name: issue-status-review
description: "Review whether the current code satisfies a GitHub issue, then update the issue status to match. Use when the user asks to 'review an issue', 'check if an issue is done', 'is this issue resolved', 'update issue status', 'issueの対応状況を確認', 'issueが完了しているかレビュー', or 'issueのステータスを更新'."
tools:
  - Bash(${CLAUDE_SKILL_DIR}/scripts/fetch-issue.ts *)
  - Bash(${CLAUDE_SKILL_DIR}/scripts/update-issue-status.ts *)
  - Read
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

# issue-status-review

Fetch a GitHub issue's body and comments, review whether the current codebase already satisfies it, update the issue status to match reality, and report the verdict to the user.

The mechanical parts — fetching issue data, posting comments, changing labels, closing/reopening — are scripts. Human and Claude effort goes into judging completion against the actual code.

## Workflow

### Step 1: Identify the Target Issue

Take the issue reference from the user (an issue number like `42`, `#42`, or a full GitHub issue URL). If the user did not name an issue, ask which one via `AskUserQuestion` — this is the one input that cannot be inferred.

### Step 2: Fetch Issue Data

Run the fetch script. It resolves the issue (number → current `origin` remote, URL → self-contained) and emits the body, all comments, labels, state, assignees, and milestone as JSON:

```bash
${CLAUDE_SKILL_DIR}/scripts/fetch-issue.ts <issue-number-or-url>
```

Read `<script> --help` first if the invocation is unclear.

### Step 3: Build the Completion Criteria

From the body **and every comment**, derive a concrete checklist of what "done" means. Comments often carry the real scope — clarifications, added requirements, narrowed scope, or "actually let's not do X". Treat the latest comments as authoritative when they conflict with the body.

For each criterion, note whether it is a hard requirement or optional, and what observable evidence would prove it satisfied (a file exists, a test passes, an API behaves a certain way).

### Step 4: Review the Current Code

Investigate the repository to decide, per criterion, whether the current code satisfies it. Do not guess — find evidence:

- Use `indexion` to map the relevant code and locate where the issue's concern lives
- Use `serena`, `Grep`, `Glob`, and `Read` to inspect the actual implementation
- Check `git log` / `git blame` for changes that reference the issue
- Run or inspect the relevant tests when completion depends on behavior

Record concrete evidence (`path/to/file.ts:42`, test names, command output) for every criterion — satisfied or not.

### Step 5: Determine the Verdict

Classify the issue overall:

| Verdict              | Meaning                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `complete`           | Every hard requirement is satisfied with evidence                     |
| `partially-complete` | Some requirements are satisfied; specific ones remain                 |
| `not-started`        | No code addresses the issue yet                                       |
| `obsolete`           | The issue no longer applies (scope removed, superseded, already moot) |

Per-criterion verdicts must each carry evidence. A criterion without evidence is "unknown", not "satisfied".

### Step 6: Report to the User

Present the review in 日本語:

- The overall verdict and a one-line rationale
- A per-criterion table: criterion / status / evidence
- For anything incomplete, what concretely remains

### Step 7: Confirm the Status Update

Never modify the issue without explicit approval. Use `AskUserQuestion` to confirm what to apply, proposing defaults based on the verdict:

| Verdict              | Proposed status update                                                               |
| -------------------- | ------------------------------------------------------------------------------------ |
| `complete`           | Post a review comment with evidence; close with `completed`; optionally label `done` |
| `partially-complete` | Post a comment listing remaining work; keep open; adjust labels if useful            |
| `not-started`        | Post a comment noting no code addresses it yet; keep open                            |
| `obsolete`           | Post a comment explaining why; close with `not_planned`                              |

Let the user accept, adjust (e.g. keep open instead of closing), or skip the update.

### Step 8: Apply the Status Update

Run the update script with only the flags the user approved:

```bash
${CLAUDE_SKILL_DIR}/scripts/update-issue-status.ts <issue> \
  --comment "<review summary>" \
  --add-label "<label>" \
  --remove-label "<label>" \
  --close --state-reason completed
```

The script runs only the requested changes and returns the resulting state. Labels not present on the issue are skipped, not treated as errors. Read `<script> --help` for the full flag list.

The review comment should be self-contained: the verdict, the per-criterion evidence, and remaining work if any. Write it so a reader who never saw this session understands the status.

### Step 9: Report the Result

Confirm to the user what was applied — the new state, labels, and the URL of the posted comment — using the JSON returned by the update script.

## Rules

- Never modify the issue (comment, labels, state) without explicit user approval in Step 7
- Every criterion verdict needs concrete evidence; no "probably done"
- Treat later comments as authoritative over the original body when they conflict
- Investigate before asking — only ask the user to pick the issue or to approve the update
- Communicate with the user in 日本語; write the posted issue comment in the issue's own language
- Both scripts require a `GITHUB_TOKEN` in the environment (the harness provides it)

## Bundled Resources

<!-- REFERENCES_START — AUTO-GENERATED by inject-references.ts — DO NOT EDIT MANUALLY -->

### Scripts

- **`scripts/fetch-issue.ts`** — Fetch a GitHub issue's body, comments, labels, state, and assignees as JSON.
- **`scripts/update-issue-status.ts`** — Apply a status update to a GitHub issue: post a review comment, add/remove
<!-- REFERENCES_END -->
