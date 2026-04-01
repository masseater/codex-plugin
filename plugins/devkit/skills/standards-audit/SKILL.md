---
name: standards-audit
description: This skill should be used when the user asks to "audit project standards", "check standards compliance", "devkit audit", "find standards violations", "are we following devkit standards", "what's not following standards", "compliance report", "規約チェック", "スタンダード監査", or "規約違反を探して". It actively scans code and reports violations. Do NOT use for project scaffolding (use init-project), single-CLI-tool checks (use cli-compliance), or looking up what the standards are (use standards).
argument-hint: "[path to project or monorepo root (default: cwd) — auto-detects type; audits each workspace independently for monorepos]"
---

# Standards Audit

Audit a project against devkit standards and report violations with improvement recommendations.

$ARGUMENTS

## Step 1: Load Standards and Parse References

1. Invoke `/devkit:standards` using the Skill tool. This loads the SKILL.md content (Philosophy section + Bundled Resources list) into context.
2. Extract the **Philosophy** section text from the loaded content.
3. Collect all reference file paths from the Bundled Resources section. These paths are relative to the standards skill directory — resolve each by prepending the standards skill root path.

## Step 2: Detect Project Type

- If `pnpm-workspace.yaml` or `package.json` `workspaces` field exists → add **monorepo** type.

Types are **not mutually exclusive** — a project can be multiple types simultaneously.

**Monorepo handling:**

1. Parse workspace glob patterns from `pnpm-workspace.yaml` (or `package.json` `workspaces`)
2. Resolve to concrete workspace directories (skip any that lack `package.json` — log a warning for each)
3. Detect the type of each workspace independently using the same signal-matching logic
4. Each workspace is audited as its own scope with its own detected types

## Step 3: Launch Subagents

**Dispatch model:** For each audit scope (single project, or each monorepo workspace + root), launch one subagent per applicable reference in parallel.

Use the **`standards-auditor`** agent (`subagent_type: "devkit:standards-auditor"`). Each invocation receives this prompt:

```
Audit scope: {scope_label}
Scope path: {absolute_path_to_scope}
Scope type: {detected_types}

## Standards to check

### Philosophy
{Philosophy section text from Step 1}

### Reference: {reference_filename}
{full content of the reference file}
```

**Subagent failure handling:** If a subagent times out, returns non-JSON output, or returns JSON that is not an array of the specified shape, add a warning to the report: `[{reference_name}] Subagent failed: {reason}`.

## Step 4: Aggregate and Report

Collect all subagent JSON results.

**Deduplication:** If multiple findings share the same `file` + `line`, keep only the one from the alphabetically-first `rule` value. Findings with different `line` values (or different `file` values) are always distinct.

**Rendering rules:**

- `file` + `line` present → render as `` `file:line` ``
- `file` present, `line` is null → render as `` `file` ``
- Both null → render as `(project-level)`

**Ordering:** Sort findings by file path (alphabetical), then line number (ascending, nulls last).

**Format for single projects:**

```
## Standards Audit Report

Project: {path}
Type: {detected types}

### Violations

- [{rule}] `file:line` — message

### Recommendations

- [{rule}] `file` — message

### Warnings

- [{reference}] Subagent failed: {reason}

Summary: N violations, M recommendations
```

**Format for monorepos (root first, then workspaces alphabetically):**

```
## Standards Audit Report

Project: {monorepo root}
Type: monorepo

### (root)

#### Violations
- [{rule}] `file:line` — message

### apps/web (web)

#### Recommendations
- [{rule}] `file` — message

Summary: N violations, M recommendations across K scopes
```

Omit empty sections (including Warnings if none). If no findings across all scopes, report: "All checks passed."

## Notes

- Report only; do not fix
- After presenting the report, ask the user if they want to fix any items

## Automated Script

For mechanical checks that run without AI, use the automated audit script:

```bash
bun skills/standards-audit/scripts/audit.ts [project-path]
```

Checks config-files, scripts, quality-libs, versions, monorepo, ci, test-structure, code-patterns, documentation and more. Categories expand automatically as new check modules are added.

The script auto-discovers check modules from `scripts/checks/*/index.ts`. To add new checks, create a new directory with an `index.ts` exporting `meta: CheckMeta` and `run(ctx: ProjectContext): Promise<Finding[]>`.

### Stop Hook

Set `DEVKIT_AUDIT_ON_STOP=1` to run the audit automatically when Claude stops. Violations block the stop and force the AI to address them.
