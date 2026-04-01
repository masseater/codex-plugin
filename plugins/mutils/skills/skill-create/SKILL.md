---
name: skill-create
description: "This skill should be used when the user asks to 'create a skill', 'add a new skill', 'make a skill', 'scaffold a skill', 'new skill', 'スキル化して', 'スキルを作成', 'スキルを追加', or wants to create a new Claude Code skill for a plugin or project. Provides a guided workflow with automated scaffolding, validation, and dynamic context injection."
disable-model-invocation: true
tools:
  - Bash(${CLAUDE_SKILL_DIR}/scripts/scaffold.ts *)
  - Bash(${CLAUDE_SKILL_DIR}/scripts/validate.ts *)
  - Bash(${CLAUDE_SKILL_DIR}/scripts/detect-context.ts *)
  - Bash(${CLAUDE_SKILL_DIR}/scripts/inject-references.ts *)
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# create-skill

Automate mechanical work (directory creation, frontmatter validation, reference injection) via scripts. Spend human effort on intent design and workflow authoring — not boilerplate.

## Current Context

!`${CLAUDE_SKILL_DIR}/scripts/detect-context.ts`

## Core Principle: Script What Can Be Scripted

Put every deterministic, repeatable step in a script — not in Claude's reasoning. This eliminates variance and saves tokens. The boundary:

| Automated (scripts)                 | Human + Claude                               |
| ----------------------------------- | -------------------------------------------- |
| Directory scaffolding               | Clarifying skill intent and use cases        |
| Frontmatter template generation     | Writing the description with trigger phrases |
| Validation (structure, style, refs) | Designing workflow steps                     |
| Context detection (plugin, skills)  | Deciding what goes in SKILL.md vs references |
| Executable permission setting       | Writing the skill body content               |

## Workflow

### Step 1: Clarify Intent

Before scaffolding, clarify the following. If the user provided enough context, skip asking and confirm instead:

1. **What the skill does** — one sentence purpose
2. **When it triggers** — specific phrases the user would say
3. **What resources it needs** — scripts (deterministic tasks), references (large docs), or neither
4. **Is it user-invocable, model-invocable, or both?**

### Step 2: Scaffold

Run the scaffold script. It creates the directory structure, SKILL.md template, and optional `scripts/`/`references/` directories in one step — no manual `mkdir` or template copying:

```bash
${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --plugin-dir <dir> --skill-name <name> [--scripts] [--references]
```

### Step 3: Write SKILL.md

Fill in the scaffolded SKILL.md. Follow these rules:

**Frontmatter:**

- `name`: kebab-case identifier
- `description`: Third-person, with quoted trigger phrases. Example: `"This skill should be used when the user asks to 'do X', 'configure Y', or mentions Z."`
- `tools`: List tools the skill needs (e.g., `Bash(${CLAUDE_SKILL_DIR}/scripts/foo.ts *)`, `Read`, `Write`)
- Optional: `disable-model-invocation: true` for task-only skills, `context: fork` for subagent execution

**Body writing rules:**

- Write SKILL.md and all bundled documents (references, examples) in English for token efficiency
- Use imperative form ("Run X", "Create Y"), not second person ("You should X")
- Target 1000-2000 words. Move detailed content to `references/`
- Reference all bundled files explicitly so Claude knows they exist
- If the skill has a deterministic pre-processing step, use `!`​`cmd` syntax for dynamic context injection

**Dynamic context injection:**

Use EXCLAMATION-BACKTICK syntax (write `!` immediately followed by a backtick-wrapped command) to inject live data before Claude sees the skill content. This saves reasoning tokens by pre-computing deterministic values:

- Inject live state (git status, current config, file listings)
- Pre-compute values that would otherwise waste Claude's reasoning
- Gather environment-specific data (paths, versions)

The `## Current Context` section above demonstrates this: `detect-context.ts` runs at skill load time and injects the plugin context JSON.

For syntax details, refer to: https://code.claude.com/docs/en/skills#inject-dynamic-context

**Caution:** This syntax executes everywhere in SKILL.md — including code fences and indented blocks. Never include literal examples of this syntax in SKILL.md itself, as they will be executed. Put examples in references or external docs.

### Step 4: Create Support Scripts

Extract deterministic logic into scripts. This prevents Claude from reinventing the same logic each session and ensures consistent behavior:

| Extract into a script when the skill needs                       | Why                                                |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| File transformation (rotating, converting, formatting)           | Deterministic — Claude should not reimplement this |
| Validation (structure, linting, schema compliance)               | Consistent checks across sessions                  |
| Data gathering (API calls, file scanning, environment detection) | Avoid wasting reasoning tokens on I/O              |
| Template generation (boilerplate, scaffolding)                   | Single source of truth for templates               |
| Index management (catalogs, manifests)                           | Eliminate manual maintenance drift                 |

**Script conventions:**

- Write as standalone TypeScript files with shebang `#!/usr/bin/env bun`
- Execute via `./script.ts` (not `bun run script.ts`)
- Set executable permission: `chmod +x scripts/*.ts`
- Output structured JSON to stdout; write human-readable errors to stderr
- Register in the frontmatter `tools` field: `Bash(${CLAUDE_SKILL_DIR}/scripts/foo.ts *)`
- Create a co-located test file `[name].test.ts` for each script
- Use `cc-hooks-ts` for hook scripts; `@r_masseater/cc-plugin-lib` for shared utilities
- When calling GitHub API, follow `references/github-api.md` (Octokit first, gh CLI last)

### Step 5: Inject References

After writing SKILL.md and creating support files, run the references injection script:

```bash
${CLAUDE_SKILL_DIR}/scripts/inject-references.ts <skill-dir>
```

**Always use this script to update the Bundled Resources section** — never hand-edit between `REFERENCES_START` and `REFERENCES_END` markers. Re-run immediately after adding, removing, or renaming files to prevent stale references.

### Step 6: Validate

Run the validation script to catch structural issues before manual review:

```bash
${CLAUDE_SKILL_DIR}/scripts/validate.ts <skill-dir>
```

Fix all errors and warnings, then re-run until clean. The script validates frontmatter, description format, word count, writing style, file references, and executable permissions.

### Step 7: Evaluate with Subagent (Score 10/10 Loop)

Iterate until a `plugin-dev:skill-reviewer` subagent scores the skill 10/10. This catches quality issues that mechanical validation misses (intent clarity, trigger coverage, workflow completeness):

1. Spawn `plugin-dev:skill-reviewer` with the skill directory path
2. Fix issues from the feedback
3. Re-run `inject-references.ts` and `validate.ts` if files changed
4. Re-evaluate — repeat until 10/10

If the subagent is unavailable, self-evaluate using the same criteria. Still iterate until 10/10.

### Step 8: Verify End-to-End

After scoring 10/10, verify the skill actually works in practice:

1. Confirm the skill appears in the available skills list
2. Test with a prompt that should trigger it
3. Test with `/skill-name` direct invocation
4. Confirm `!cmd` injections produce expected output

## Checklist

Use this checklist before considering the skill complete:

- [ ] Intent is clear and specific
- [ ] Description has 2+ quoted trigger phrases
- [ ] Description uses third-person
- [ ] Body uses imperative form
- [ ] Body is 1000-2000 words (or justified if shorter/longer)
- [ ] Deterministic tasks are in scripts, not instructions
- [ ] Dynamic context uses `!cmd` where applicable
- [ ] All referenced files exist
- [ ] Scripts have executable permission
- [ ] Validation script passes with no errors
- [ ] Subagent evaluation score is 10/10

## Anti-patterns

| Anti-pattern                                           | Better approach                               |
| ------------------------------------------------------ | --------------------------------------------- |
| Instructing Claude to "create the directory structure" | Use scaffold script                           |
| Writing validation logic in SKILL.md prose             | Create a validation script                    |
| Embedding large reference docs in SKILL.md             | Move to `references/` and link                |
| Vague description ("Helps with X")                     | Specific triggers ("create X", "configure Y") |
| Second-person instructions ("You should...")           | Imperative form ("Run...", "Create...")       |
| Hardcoding paths in SKILL.md                           | Use `${CLAUDE_SKILL_DIR}` variable            |
| Manual file permission setting                         | Script it or document in scaffold             |
| Hand-editing Bundled Resources section                 | Re-run `inject-references.ts`                 |

## Bundled Resources

<!-- REFERENCES_START — AUTO-GENERATED by inject-references.ts — DO NOT EDIT MANUALLY -->

### Scripts

- **`scripts/detect-context.ts`** — Detect the current plugin context for skill creation.
- **`scripts/inject-references.ts`** — Scan a skill directory and inject a references section into its SKILL.md.
- **`scripts/scaffold.ts`** — Scaffold a new skill directory with SKILL.md template and optional subdirectories.
- **`scripts/validate.ts`** — Validate a SKILL.md file for quality and completeness.

### References

- **`references/github-api.md`** — GitHub API guidelines: use gh auth token + Octokit instead of gh CLI directly
<!-- REFERENCES_END -->
