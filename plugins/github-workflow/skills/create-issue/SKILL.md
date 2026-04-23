---
name: create-issue
description: Create a GitHub issue in the current repository with a drafted title, body, and labels, confirming with the user before submission. Use when the user says "issueを作成", "GitHub issueを立てる", "create issue", "新しいissue", "バグ報告issue", or wants to file a new issue from conversation or investigation context.
---

# Create a GitHub Issue

Draft, confirm, and submit a GitHub issue on the current repository. Always confirm with the user before creating — never auto-create without approval.

## Input Contract

Accept either:

- Freeform context from the conversation, OR
- A finding object from `mutils:investigate-repo`:
  ```json
  {
    "id": "...",
    "title": "...",
    "severity": "...",
    "category": "...",
    "evidence": ["..."],
    "suggested_fix": "..."
  }
  ```

## Output Contract

On success, return:

```json
{
  "number": 42,
  "url": "https://github.com/OWNER/REPO/issues/42",
  "title": "...",
  "labels": ["..."]
}
```

## Workflow

### Step 1: Resolve Repository

```bash
gh repo view --json nameWithOwner,defaultBranchRef -q .
```

Confirm with user if the detected repo is not the one they mean.

### Step 2: Draft Title

- Concise (≤ 72 chars)
- English
- Imperative or descriptive — no leading emoji, no trailing period
- Include a scope prefix when applicable: `[<plugin-or-package>] <summary>`

### Step 3: Draft Body

Template (Markdown, English):

```markdown
## Context

<what was being worked on, why this issue was surfaced>

## Description

<clear description of the problem or request>

## Evidence

- `path/to/file.ts:42` — <snippet or note>
- `path/to/other.ts:13`

## Expected vs Actual (bugs only)

- Expected: <...>
- Actual: <...>

## Suggested Direction

<one or two sentences, not a full plan>

## Additional Context

- Severity: <blocker|high|medium|low>
- Category: <bug|tech-debt|...>
- Related: #<nnn> (if known from `github-issue-db:search-similar-issues`)
```

### Step 4: Choose Labels

Map category → label (adjust to actual repo labels; query them first):

```bash
gh label list --repo OWNER/REPO --limit 100 --json name
```

Default mappings:

| Category      | Labels          |
| ------------- | --------------- |
| `bug`         | `bug`           |
| `tech-debt`   | `tech-debt`     |
| `test-gap`    | `test`          |
| `doc`         | `documentation` |
| `dependency`  | `dependencies`  |
| `performance` | `performance`   |
| `security`    | `security`      |
| `lint`/`type` | `tech-debt`     |

Add repo-specific automation labels when they exist (e.g. `claude` triggers Claude Code Action in this repo). Never invent a label that does not exist in the target repo.

### Step 5: Preflight — Duplicate Check

Strongly recommend calling `github-issue-db:search-similar-issues` first if not already done. If `recommendation = duplicate`, STOP and route to `github-issue-db:update-existing-issues` instead (commenting on the existing issue is better than filing a duplicate).

### Step 6: Confirm with User (`AskUserQuestion`)

Show the drafted title, body, and labels. Ask:

- Create as drafted?
- Edit title/body?
- Change labels?
- Cancel?

Never skip this step.

### Step 7: Create

Prefer Octokit (per `references/github-api.md` in `mutils:skill-create`):

```typescript
await octokit.issues.create({
  owner,
  repo,
  title,
  body,
  labels,
});
```

`gh` CLI fallback when Octokit is unavailable:

```bash
BODY_FILE=$(mktemp -t issue-body.XXXXXX.md)
trap 'rm -f "$BODY_FILE"' EXIT
cat > "$BODY_FILE" <<'EOF'
<issue body>
EOF
gh issue create \
  --repo OWNER/REPO \
  --title "<title>" \
  --body-file "$BODY_FILE" \
  --label "<a>" --label "<b>"
```

Use `--body-file` (not `--body`) to avoid shell-escaping on multi-line content, and use `mktemp` so parallel runs do not collide on a shared path.

### Step 8: Report

Return the JSON contract above and surface the URL to the user.

## Rules

- Never create without explicit user approval
- English title/body, 日本語 for user conversation
- No secrets, no internal URLs, no PII in the body
- Do not include conversation transcripts verbatim — distill the issue
- Verify labels exist in the target repo before passing them
- Do not pick a milestone or assignee unless the user asked
