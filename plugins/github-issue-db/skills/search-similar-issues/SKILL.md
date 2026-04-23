---
name: search-similar-issues
description: Search GitHub issues from a locally-cached SQLite DB (FTS5 trigram + BM25 + label/recency boost, no ML model) for duplicates or near-duplicates of a proposed issue. Use when the user says "似たissueを探す", "duplicate issue check", "search similar issues", "類似issueを調べる", "既存issueを検索", or before creating a new issue to avoid duplicates.
---

# Search Similar Issues via Local DB

Query the per-repo SQLite cache of GitHub issues maintained by `github-issue-db` and return ranked candidates with duplicate-likelihood. Pure SQLite search — FTS5 trigram index for language-agnostic matching, BM25 for relevance, plus label overlap and recency boosts. No ML model, no remote calls.

Deterministic work lives in scripts. This SKILL orchestrates them.

## Input Contract

Either a raw query string, or a finding from `mutils:investigate-repo`:

```json
{ "id": "...", "title": "...", "search_keywords": ["..."], "evidence": ["path:line"] }
```

## Output Contract

For each input finding:

```json
{
  "query": "<effective query>",
  "candidates": [
    {
      "number": 123,
      "title": "...",
      "state": "open" | "closed",
      "url": "...",
      "updatedAt": "...",
      "labels": ["bug"],
      "similarity": "high" | "medium" | "low",
      "rationale": "..."
    }
  ],
  "recommendation": "duplicate" | "related" | "no-match"
}
```

## Workflow

### Step 1: Ensure the Cache is Fresh

Run the sync script. It performs an incremental sync (`since` based) or a full sync as needed:

```bash
../../scripts/sync.ts
```

Skip sync if the previous skill invocation already synced within 15 minutes — check the returned `last_sync` from a prior `sync.ts` run stored by the caller or just run `sync.ts` again (it is cheap when up-to-date).

### Step 2: Compose an Effective Query

Combine the finding fields into a single natural-language query string:

- title verbatim
- top 3 `search_keywords`
- the most distinctive file path or symbol from `evidence` (last path segment is often best)

Do not add GitHub search syntax (`is:issue`, `label:`) — the local FTS5 index does not use it. The script handles tokenization.

### Step 3: Run the Search Script

```bash
../../scripts/search.ts "<query>" --limit 20
```

Use `--openOnly` only when the user explicitly excluded closed issues — past resolutions matter.

The script returns JSON with `candidates[]` scored by `0.7 * bm25_norm + 0.2 * label_jaccard + 0.1 * recency`. Each candidate exposes the component scores so the caller can explain ranking.

### Step 4: Assign Similarity Labels

Map the numeric `score` from the script to the categorical `similarity`:

| Condition                                                                               | similarity |
| --------------------------------------------------------------------------------------- | ---------- |
| `bm25Norm ≥ 0.85` AND title/body share a concrete file path OR symbol match (from body) | `high`     |
| `score ≥ 0.55`                                                                          | `medium`   |
| `score ≥ 0.30`                                                                          | `low`      |
| else                                                                                    | drop       |

These thresholds are heuristic starting points — tune per-repo by comparing a handful of known-duplicate runs before trusting auto-routing.

For each survivor, read the cached body via `../../scripts/show.ts <number>` when the title alone does not justify the similarity tier. Write the `rationale` in one short sentence citing the strongest signal (matching symbol / path / error string / paraphrase).

Never promote to `high` on title overlap alone.

### Step 5: Recommend

- `duplicate` — ≥1 open `high` → caller should comment instead of creating
- `related` — only closed `high` or open `medium` → caller should create + cross-link
- `no-match` — nothing ≥ `medium` → safe to create

### Step 6: Report

Emit the JSON contract AND a readable Markdown summary (strategy, top candidates table, recommendation).

## Rules

- Sync must run before search on a first-time or stale cache
- No ML model involved — search is pure SQLite FTS5 + arithmetic. Fast and deterministic
- Search API rate-limits do not apply here (local cache), but sync still calls GitHub; respect `x-ratelimit-remaining`
- Cap returned candidates at 20 (default 10); beyond that, the ranking tail is noise
- Communicate with the user in 日本語; script output and scoring are English
- Title-only matches never promote to `high`
