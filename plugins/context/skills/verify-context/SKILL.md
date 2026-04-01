---
name: verify-context
description: Use when someone says "verify context file", "check if AGENTS.md is correct", "validate context accuracy", "audit CLAUDE.md", "check documentation truth", "are the docs accurate", or mentions "context verification" or "documentation audit". Treats all existing content as potentially incorrect, extracts every technical claim, and verifies each against the actual codebase and web sources.
argument-hint: "[file-path]"
---

Treat context files as **entirely untrustworthy**. Extract every technical claim, verify each against the actual codebase and external sources, and silently fix anything that is wrong.

$ARGUMENTS

## Philosophy

> Every statement in the file might be wrong. Prove it correct with evidence, or flag it as incorrect.

Never trust a claim simply because it "sounds reasonable" or "matches training data". Treat internal knowledge as equally untrustworthy — only evidence from the actual codebase and authoritative web sources counts.

## Architecture

```
Parent Process
  +-- Determine target files (single file or project scan)
  +-- For each file:
  |     +-- Read file & split into sections
  |     +-- Extract claims per section
  |     +-- 8 subagents in parallel per batch
  |     |     +-- Agent N: Verify claims in section N
  |     +-- Auto-apply all fixes
  +-- Done
```

## Execution Steps

### 0. Determine Target Files

**If `$ARGUMENTS` specifies a file path**:

- Verify the file exists and is `.md`
- Process that single file

**If `$ARGUMENTS` is empty** (project-wide mode):

- Scan for all context files: `**/AGENTS.md`, `.claude/rules/**/*.md`, `**/CLAUDE.md`
- Process each file sequentially

### 1. Read File and Split into Sections

- Read the target file
- Detect Markdown headings (#, ##, ###) and split into sections
- Skip frontmatter (YAML) and ignore `#` inside code blocks
- Record for each section: heading level, heading text, content, start line, end line

### 2. Extract Claims from Each Section

Before launching subagents, extract concrete, verifiable claims from each section. A "claim" is any statement that can be checked against reality.

| Category                     | Example                           | How to Verify                    |
| ---------------------------- | --------------------------------- | -------------------------------- |
| **File/directory existence** | "`plugins/` contains plugin code" | Glob for the path                |
| **Command behavior**         | "`bun run check` runs lint"       | Read package.json scripts        |
| **Tool/version reference**   | "Uses Biome for linting"          | Check config files, package.json |
| **Configuration**            | "Hooks are in hooks.json"         | Glob/Read the file               |
| **Workflow description**     | "Pre-commit runs security check"  | Read lefthook.yml or equivalent  |
| **Cross-file reference**     | "CLAUDE.md references AGENTS.md"  | Read the referenced file         |
| **External tool/API**        | "tsgo is native TypeScript 7.x"   | WebSearch for current status     |
| **Structural claim**         | "5 skills in context plugin"      | Count actual skill directories   |

### 3. Launch Subagents in Parallel

Launch up to 8 subagents simultaneously. For 9+ sections, batch by 8.

Each subagent receives the following prompt:

```
You are a fact-checker for technical documentation. Verify whether claims are TRUE or FALSE.

IMPORTANT: Do NOT trust your own knowledge. Only evidence from the actual codebase (Grep/Glob/Read) and web searches (WebSearch) counts. If you cannot find evidence, the claim is UNVERIFIED, not "probably true".

## Target Section

- **File**: {file-path}
- **Section**: {number}/{total} — {heading}
- **Lines**: {start}-{end}

## Section Content

```

{content}

```

## Claims to Verify

{numbered list of claims with verification methods}

## Verification Protocol

For EACH claim:

1. **Search the codebase**: Use Grep/Glob/Read to find evidence
2. **Search the web** (if claim involves external tools/versions): Use WebSearch
3. **Record evidence**: Exact file paths, line numbers, or URLs found
4. **Determine verdict**:
   - VERIFIED: Evidence confirms the claim
   - FALSE: Evidence contradicts the claim
   - OUTDATED: Was true but no longer accurate
   - UNVERIFIED: Cannot find evidence either way

## Output Format

For each claim:

**Claim {N}**: "{claim text}"
- **Verdict**: {VERIFIED|FALSE|OUTDATED|UNVERIFIED}
- **Evidence**: {file paths, line numbers, or URLs}
- **Correction** (if FALSE/OUTDATED): {correct statement}

If any claims are FALSE or OUTDATED, provide:

**Proposed Fix**:

{Updated section content with corrections applied}

**Changes**:
- {change 1}
- {change 2}
```

**Agent tool settings**:

- `subagent_type`: "general-purpose"
- `description`: "Verify section {number}: {heading}"

### 4. Auto-Apply Fixes

Automatically apply all corrections. No user confirmation. No reporting.

1. Collect all sections with FALSE or OUTDATED claims that have a proposed fix
2. Sort by **end line descending** (prevent line number drift)
3. Replace each section's content with the corrected version
4. Save the file
5. Leave UNVERIFIED claims unchanged

## Notes

- `@filepath` external references: Verify the referenced file exists but do not expand
- Frontmatter (YAML): Not a section; preserve as-is
- `#` inside code blocks: Not headings
- File updates: Process from bottom to top (prevent line drift)
- Sections with zero extractable claims: Still send to a subagent to check for implicit assumptions

## Reference

- @./references/claim-extraction-patterns.md - Detailed claim extraction heuristics and edge cases
