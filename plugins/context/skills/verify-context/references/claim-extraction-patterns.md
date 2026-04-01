# Claim Extraction Patterns

Detailed heuristics for extracting verifiable claims from context files.

## Extraction Rules

### Rule 1: Every Noun Path is a Claim

Any file path, directory path, or URL mentioned in the document is a claim of existence.

```
"plugins/ contains plugin code"
  -> Claim: directory `plugins/` exists
  -> Verify: Glob("plugins/")
```

### Rule 2: Every Command is a Claim

Any shell command or script reference claims that command works as described.

```
"bun run check runs lint + format check (Biome)"
  -> Claim 1: `check` script exists in package.json
  -> Claim 2: `check` script invokes Biome
  -> Verify: Read package.json, find "check" in scripts
```

### Rule 3: Every Count is a Claim

Any numeric count (e.g., "5 skills", "3 hooks") can be verified.

```
"5 skills in context plugin"
  -> Claim: exactly 5 skill directories exist under skills/
  -> Verify: Glob("plugins/context/skills/*/SKILL.md") and count
```

### Rule 4: Every Table Row is a Claim

Tables in context files often map names to descriptions. Each row is a separate claim.

```
| Plugin | Description |
| mutils | General utilities |
| sdd    | Spec Driven Dev  |

  -> Claim 1: plugin "mutils" exists
  -> Claim 2: mutils description matches actual functionality
  -> Claim 3: plugin "sdd" exists
  -> Claim 4: sdd description matches actual functionality
```

### Rule 5: Every Tool/Version Reference is a Claim

Tool names and version numbers become outdated quickly.

```
"tsgo = native TypeScript 7.x"
  -> Claim: tsgo is the native TypeScript compiler at version 7.x
  -> Verify: WebSearch("tsgo TypeScript native compiler"), check package.json
```

### Rule 6: Cross-file References are Claims

Any reference to another file's content is a claim about that file.

```
"CLAUDE.md contains @AGENTS.md only"
  -> Claim: CLAUDE.md exists and its only content is "@AGENTS.md"
  -> Verify: Read CLAUDE.md
```

### Rule 7: Workflow Descriptions are Claims

Process descriptions (hooks, CI, pre-commit) claim specific behavior.

```
"lefthook runs pre-commit security check"
  -> Claim 1: lefthook is configured
  -> Claim 2: pre-commit hook exists
  -> Claim 3: pre-commit includes security check
  -> Verify: Read lefthook.yml or .lefthook.yml
```

### Rule 8: Dependency/Prerequisite Statements are Claims

```
"All plugins require mutils to be installed"
  -> Claim: mutils is a prerequisite for other plugins
  -> Verify: Check if plugins reference mutils in their code/docs
```

## Edge Cases

### Subjective Statements

Statements like "clean architecture" or "well-organized" are not verifiable claims. Skip these.

### Future Intentions

Statements about planned features ("will support X") are not verifiable against current state. Flag as UNVERIFIED with note.

### Conditional Statements

"If X is installed, then Y works" — verify both the condition mechanism and the result.

### Implicit Claims

Some sections make claims implicitly through structure:

```
## Skills

| Skill | Description |
| a     | Does X      |
| b     | Does Y      |
```

This implicitly claims:

1. These are ALL the skills (completeness)
2. Each skill exists
3. Each description is accurate

Always check for missing items, not just incorrect ones.

## Verification Priority

When time is limited, prioritize:

1. **File/directory existence** — fastest to verify, most impactful if wrong
2. **Command behavior** — users rely on these directly
3. **Counts and lists** — completeness errors are common
4. **Version numbers** — frequently outdated
5. **Workflow descriptions** — hardest to verify, but errors cause confusion
