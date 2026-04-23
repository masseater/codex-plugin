---
name: investigate-repo
description: Investigate the current repository to surface issues, defects, and improvement opportunities. Use when the user says "調査して課題", "リポジトリを調査", "investigate repo", "find issues in repo", "問題を洗い出す", "課題を見つける", or wants a structured report of problems detected in the codebase.
---

# Investigate Repository for Issues

Scan the current repository and produce a structured list of candidate issues (bugs, stale code, missing tests, broken invariants, suspicious patterns, deprecated dependencies, TODO/FIXME markers, CI/lint/type failures, documentation drift). Do not open GitHub issues here — that is the job of `github-workflow:create-issue` or `github-issue-db:report-repo-issues`.

## Output Contract

Produce a JSON-shaped list of findings (also render as Markdown for the user). Each finding MUST have:

- `id` — stable kebab-case slug derived from the symptom (e.g. `stale-any-type-in-ops-harbor`)
- `title` — one-line summary, imperative or descriptive
- `severity` — `blocker` | `high` | `medium` | `low`
- `category` — `bug` | `tech-debt` | `test-gap` | `doc` | `dependency` | `performance` | `security` | `lint` | `type` | `other`
- `evidence` — concrete file paths with line numbers, command output snippets, or commit hashes
- `suggested_fix` — one or two sentences of direction (not a full plan)
- `search_keywords` — 3–6 keywords usable by `github-issue-db:search-similar-issues`

Findings without concrete `evidence` are forbidden. Speculation is not a finding.

## Workflow

### Step 1: Establish Scope

Ask (via `AskUserQuestion`) only if scope is ambiguous. Otherwise assume the whole repo:

- Specific path/plugin/package, or entire repo?
- Category filter (e.g. only `security`, or everything)?
- Severity floor (include `low` or not)?

Skip the question if the user already specified scope in their prompt.

### Step 2: Parallel Signal Collection

Run these in parallel. Record raw output for evidence. Prefer Bash in parallel tool calls:

- `git log --oneline -n 20` — recent changes context
- `bun run check` / `bun run typecheck` at repo root (or affected plugin) — surface lint/type errors
- `bun run test` if quick; otherwise skip and note as unverified
- `rg -n "TODO|FIXME|HACK|XXX"` excluding `node_modules`, `.agents`, `coverage`
- `rg -n ": any\b|<any>|as any\b|Array<any>" --type ts` (TS-specific `any` usage; avoid `any\b` which matches identifiers like `companyName`)
- `rg -n "@deprecated"`
- `git grep -nE "console\.(log|warn|error)"` — stray debug logs
- `bun outdated` or `npm outdated` per workspace — stale deps (optional, expensive)
- Read `AGENTS.md`, `CLAUDE.md`, and `.claude/rules/` to infer project invariants, then look for violations

When the repo is large, delegate broad searches to an `Explore` subagent with `thoroughness: medium`. Always pass `model: sonnet` (or `opus`) — AGENTS.md forbids haiku subagents, and Explore's default may resolve to haiku in some harness configurations.

### Step 3: Triangulate and Deduplicate

For each raw signal:

1. Read the surrounding code (`Read` the file around the hit line)
2. Decide if it is a real issue or intentional
3. Collapse duplicates (same root cause across multiple files → one finding, list all sites under `evidence`)

### Step 4: Rank

Order findings: `blocker` first, then `high`, `medium`, `low`. Within a tier, prefer findings with more evidence sites or those affecting shared packages (`packages/`, `apps/`).

### Step 5: Render

Output in this shape:

```markdown
## Repository Investigation — <short scope>

<one-paragraph summary: totals by severity, hotspot areas>

### Findings

#### [<severity>] <title>

- **id**: `<slug>`
- **category**: <category>
- **evidence**:
  - `path/to/file.ts:42` — <quoted snippet or short description>
  - `path/to/other.ts:13`
- **suggested fix**: <one or two sentences>
- **keywords**: <comma-separated>

---
```

Also emit the same data as a fenced JSON block so downstream skills (`github-issue-db:search-similar-issues`, `github-issue-db:report-repo-issues`) can parse it without re-scraping Markdown:

```json
[
  {
    "id": "...",
    "title": "...",
    "severity": "...",
    "category": "...",
    "evidence": ["path:line", "..."],
    "suggested_fix": "...",
    "search_keywords": ["...", "..."]
  }
]
```

## Rules

- Evidence only — no "possibly", "might be", "perhaps"
- Prefer fewer, well-evidenced findings over many weak ones
- Respect `.claude/rules/ai-generated/gotchas.md` when interpreting signals (e.g. JSONL parsing rule)
- Communicate with the user in 日本語; produce finding content in English for downstream reuse
- Do NOT call `gh`/Octokit here — this skill is local-only
