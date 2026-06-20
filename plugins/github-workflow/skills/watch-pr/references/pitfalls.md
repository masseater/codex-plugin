---
description: "GitHub PR monitoring pitfalls — edge cases that silently break monitoring workflows"
---

# PR Monitoring Pitfalls

## Merge Conflicts Prevent GHA Dispatch

When `mergeStateStatus` is `dirty`, GitHub cannot compute the merge ref. Observed in practice: GitHub Actions workflows triggered by `pull_request` events are **not dispatched at all** — they do not appear in `gh pr checks`. External integrations (Vercel, CodeRabbit, etc.) may still run on the head commit and report results. `push`-triggered workflows also run on the head commit but do not test the merged state. Always check conflict status BEFORE evaluating CI. GHA checks will not arrive until conflicts are resolved.

## `mergeable` Field Returns `null`

GitHub computes mergeability asynchronously. The first `pulls.get` call after a push often returns `mergeable: null`. Retry 2-3 times with 2-second delays. If still null after retries, report and defer.

## Dismissed Approvals

A new push can dismiss prior approvals. The `reviewDecision` field may lag behind individual review states. Cross-check via the GraphQL `latestOpinionatedReviews` connection (or REST `pulls.listReviews` filtered to the latest per author) for `DISMISSED` state. Do NOT treat a PR as approved if any approval was dismissed — the reviewer must re-approve.

## Draft PRs Cannot Be Merged

Draft PRs run CI and branch protection rules are still evaluated, but GitHub blocks the merge button regardless of check status. A draft PR with green CI is NOT merge-ready — the draft status itself prevents merging. Always check `isDraft` before declaring a PR ready.

## Check Suites vs Status Checks

GitHub has two separate systems: Checks API (check runs/suites) and Statuses API (commit statuses). `checks.listForRef` only returns Checks API results. `repos.getCombinedStatusForRef` only returns Statuses API results. To get complete CI status, query **both** endpoints — neither covers the other.

## PR Merged or Closed During Monitoring

The PR state can change while monitoring. Branch deletion after merge causes `headRefOid` lookups to 404. Always check `state` field before each monitoring cycle. Treat `MERGED`/`CLOSED` as terminal — exit the monitoring loop.

## Auto-Merge Enabled PRs

When `autoMergeRequest` is non-null, GitHub merges automatically once conditions are met. The monitoring agent should NOT attempt its own merge. Report the auto-merge status and limit actions to fixing blockers (CI failures, review requests).

## Merge Queue

Repositories with merge queue enabled may show `mergeStateStatus: BLOCKED` for queued PRs (behavior varies by configuration). This can be normal — do NOT automatically treat `BLOCKED` as an error without checking whether a merge queue is active. The merge queue runs its own CI. `gh pr checks` may not show queue-internal checks. Check via GraphQL `mergeQueue` field on the `PullRequest` or `Repository` object if needed.

## Rate Limits

Each `pulls.get`, `checks.listForRef`, `pulls.listReviews` call costs REST API quota (5000/hour). Monitoring N PRs with M checks each can burn quota quickly. Batch with GraphQL where possible. Check `X-RateLimit-Remaining` header when monitoring multiple PRs.

## `gh pr list` Default Limit

`gh pr list` returns max 30 items by default. For repos with many open PRs, results are silently truncated. Use `--limit 100` or Octokit with `per_page: 100` to avoid this.

## Required Reviewers vs CODEOWNERS

`reviewRequests` shows explicitly requested reviewers but may miss CODEOWNERS-assigned reviewers. Use `reviewDecision` (via GraphQL) as the authoritative review status rather than counting individual approvals.

## `statusCheckRollup` State Edge Cases

The GraphQL `StatusCheckRollup` object has a top-level `state` field (type `StatusState`) that aggregates results from both Checks API and legacy Statuses API. Individual items in `StatusCheckRollup.contexts.nodes` are a union type (`StatusCheckRollupContext`): either `CheckRun` (with `status`/`conclusion`) or `StatusContext` (with `state: StatusState`). Key edge cases:

- `null` (rollup itself is null) — No checks have ever run on this commit. Treat as "no CI data."
- `EXPECTED` — A legacy commit status is expected from an external service but has not reported yet. This is a Statuses API concept, not a Checks API state. Do not confuse with `PENDING`.
- `PENDING` — A check is actively in progress.

Do NOT treat `null` or `EXPECTED` as success.

## Checks API Pagination

`checks.listForRef` returns at most 30 check runs per page by default (100 is the maximum allowed `per_page` value, not the default). Repos with large matrix builds may exceed a single page. If accurate check counting is critical, use `octokit.paginate` or set `per_page: 100`.

## Base Branch Updated During CI

Other PRs may merge into the base branch while CI is running. After CI completes, re-check `mergeStateStatus` — new conflicts may have appeared, invalidating CI results. The ci-watcher agent already does this re-check after CI watch completes.

## Head Branch Deleted

After merge with "delete branch" enabled, the head branch is removed. API calls referencing the head SHA may 404. Catch these errors and treat as "PR completed — monitoring done."
