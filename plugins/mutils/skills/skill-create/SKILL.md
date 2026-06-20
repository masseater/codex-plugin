---
name: mutils:skill-create
description: "This skill should be used when the user asks to 'create a skill', 'add a new skill', 'make a skill', 'scaffold a skill', 'new skill', 'スキル化して', 'スキルを作成', 'スキルを追加', or wants to create a new Claude Code skill for a plugin or project. Provides a guided workflow with automated scaffolding, validation, and dynamic context injection."
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

- Directory scaffolding — Clarifying skill intent and invocation use cases
- Frontmatter template generation — Writing the description for that invocation mode
- Validation (structure, style, refs) — Designing workflow steps
- Context detection (plugin, skills) — Deciding what goes in SKILL.md vs references
- Executable permission setting — Writing the skill body content

## Capability Placement Policy

Default to skills, assets, hooks, MCP tools, and scripts for both new and existing capabilities. Do not create or keep slash commands unless there is a concrete compatibility requirement that cannot be met with a skill or hook.

Skills MUST have `disable-model-invocation: true` by default, whether newly created or already existing. Remove that frontmatter field only after deciding the model should autonomously invoke the skill from ordinary user context. Record that design decision in the owning plugin's `AGENTS.md`. A skill intended only for direct skill-name invocation, a menu-like manual workflow, a manual state change, or an internal/low-level reference keeps `disable-model-invocation: true`.

Define natural-language triggers in `description` only for model-invocable skills. Disabled skills should describe the direct invocation or internal reference purpose without broad `Use when ...` trigger language.

Resource placement:

- Single-consumer guidance or templates: put them in the owning skill's `assets/` directory instead of creating a separate skill.
- Shared by multiple skills in the same plugin: put them in plugin-level `assets/`, beside `skills/`, and reference them through `${CLAUDE_PLUGIN_DIR}/assets/...`.
- Shared across plugins: first reconsider whether the plugins should be split. If the split is still justified and shared behavior is unavoidable, create the shared skill in `mutils`.

```pseudocode
function chooseCapability(request):
  if request.requires_slash_command_compatibility and no_skill_or_hook_alternative_exists:
    return "command_exception"

  if request.is_event_driven:
    return "hook"

  if request.is_deterministic_action:
    return "script_or_mcp_tool_called_from_skill"

  return "skill_with_disable_model_invocation_true"

function chooseSkillInvocation(skill):
  skill.frontmatter["disable-model-invocation"] = true
  skill.description = "direct invocation or internal reference description"

  if skill.should_be_called_autonomously_by_ai:
    skill.description = "natural language trigger description"
    write_invocation_decision_to_plugin_agents_md(skill)
    remove skill.frontmatter["disable-model-invocation"]

  if skill.frontmatter["disable-model-invocation"] == true:
    do_not_define_natural_language_triggers(skill)

function placeSharedMaterial(material):
  if material.used_by_one_skill:
    return "owning_skill/assets/"

  if material.used_by_multiple_skills_in_same_plugin:
    return "plugin/assets/ referenced via ${CLAUDE_PLUGIN_DIR}/assets/..."

  if material.used_across_plugins:
    if plugin_split_is_not_justified:
      merge_or_reframe_plugin_boundary()
    else:
      return "mutils shared skill"
```

## Workflow

### Step 1: Clarify Intent

Before scaffolding, clarify the following. If the user provided enough context, skip asking and confirm instead:

1. What the skill does — one sentence purpose
2. Invocation use case — whether ordinary natural language should invoke it, or whether it is direct-only/internal
3. What resources it needs — scripts (deterministic tasks), references (large docs), or neither
4. Is model invocation intentionally needed? — default is direct user invocation with `disable-model-invocation: true`; autonomous invocation requires a decision note in the owning plugin's `AGENTS.md`
5. Where support material belongs — owning skill `assets/`, plugin-level `assets/`, or a justified shared `mutils` skill

### Step 2: Scaffold

Run the scaffold script. It creates the directory structure, SKILL.md template with `disable-model-invocation: true`, and optional `scripts/`/`references/` directories in one step — no manual `mkdir` or template copying:

```bash
${CLAUDE_SKILL_DIR}/scripts/scaffold.ts --plugin-dir <dir> --skill-name <name> [--scripts] [--references]
```

### Step 3: Write SKILL.md

Fill in the scaffolded SKILL.md. Follow these rules:

**Frontmatter:**

- `name`: kebab-case identifier
- `description`: Third-person. For model-invocable skills, include quoted natural-language trigger phrases. Example: `"This skill should be used when the user asks to 'do X', 'configure Y', or mentions Z."` For `disable-model-invocation: true` skills, describe the direct invocation/internal purpose without broad trigger phrases.
- `disable-model-invocation: true`: Required default for every skill. Remove it only when autonomous AI invocation is the intended behavior, and document that decision in the owning plugin's `AGENTS.md`.
- `tools`: List tools the skill needs (e.g., `Bash(${CLAUDE_SKILL_DIR}/scripts/foo.ts *)`, `Read`, `Write`)
- Optional: `context: fork` for subagent execution

**Body writing rules:**

- MUST: write SKILL.md and all bundled documents (references, examples) in English for token efficiency
- MUST: use imperative form ("Run X", "Create Y"); MUST NOT: use second person ("You should X")
- SHOULD: target 1000-2000 words; move detailed content to `references/`
- MUST: reference all bundled files explicitly so Claude knows they exist
- MUST: keep support material used by only this skill in `assets/` rather than splitting it into another skill
- IF: the skill has a deterministic pre-processing step; THEN SHOULD: use the dynamic context injection syntax described below

**Dynamic context injection:**

Use EXCLAMATION-BACKTICK syntax (write `!` immediately followed by a backtick-wrapped command) to inject live data before Claude sees the skill content. This saves reasoning tokens by pre-computing deterministic values:

- Inject live state (git status, current config, file listings)
- Pre-compute values that would otherwise waste Claude's reasoning
- Gather environment-specific data (paths, versions)

The `## Current Context` section above demonstrates this: `detect-context.ts` runs at skill load time and injects the plugin context JSON.

For syntax details, refer to: https://code.claude.com/docs/en/skills#inject-dynamic-context

**Caution:** This syntax executes everywhere in SKILL.md — including code fences and indented blocks. MUST NOT: include literal examples of this syntax in SKILL.md itself (they will be executed); put examples in references or external docs instead.

### Step 4: Create Support Scripts

Extract deterministic logic into scripts. This prevents Claude from reinventing the same logic each session and ensures consistent behavior:

- File transformation (rotating, converting, formatting) — Deterministic — Claude should not reimplement this
- Validation (structure, linting, schema compliance) — Consistent checks across sessions
- Data gathering (API calls, file scanning, environment detection) — Avoid wasting reasoning tokens on I/O
- Template generation (boilerplate, scaffolding) — Single source of truth for templates
- Index management (catalogs, manifests) — Eliminate manual maintenance drift

**Script conventions:**

- MUST: write scripts as standalone TypeScript files with shebang `#!/usr/bin/env bun`
- MUST: execute via `./script.ts` (not `bun run script.ts`)
- MUST: set executable permission with `chmod +x scripts/*.ts`
- MUST: output structured JSON to stdout; write human-readable errors to stderr
- MUST: register the script in the frontmatter `tools` field: `Bash(${CLAUDE_SKILL_DIR}/scripts/foo.ts *)`
- SHOULD: create a co-located test file `[name].test.ts` for each script
- MUST: use `cc-hooks-ts` for hook scripts; `@r_masseater/cc-plugin-lib` for shared utilities
- IF: calling the GitHub API; THEN MUST: follow `references/github-api.md` (Octokit first, gh CLI last)

### Step 5: Inject References

After writing SKILL.md and creating support files, run the references injection script:

```bash
${CLAUDE_SKILL_DIR}/scripts/inject-references.ts <skill-dir>
```

- MUST: use this script to update the Bundled Resources section
- MUST NOT: hand-edit between `REFERENCES_START` and `REFERENCES_END` markers (run the script instead)
- IF: files were added, removed, or renamed; THEN MUST: re-run the script immediately to prevent stale references

### Step 6: Validate

Run the validation script to catch structural issues before manual review:

```bash
${CLAUDE_SKILL_DIR}/scripts/validate.ts <skill-dir>
```

MUST: fix all errors and warnings, then re-run until clean. The script validates frontmatter, description format, word count, writing style, file references, and executable permissions.

### Step 7: Evaluate with Subagent (Score 10/10 Loop)

MUST: iterate until a `plugin-dev:skill-reviewer` subagent scores the skill 10/10. This catches quality issues that mechanical validation misses (intent clarity, trigger coverage, workflow completeness):

1. Spawn `plugin-dev:skill-reviewer` with the skill directory path
2. Fix issues from the feedback
3. IF: files changed; THEN MUST: re-run `inject-references.ts` and `validate.ts`
4. Re-evaluate — repeat until 10/10

IF: the subagent is unavailable; THEN MUST: self-evaluate using the same criteria and still iterate until 10/10.

### Step 8: Verify End-to-End

After scoring 10/10, verify the skill actually works in practice:

1. Confirm the skill appears in the available skills list
2. Test with a prompt that should trigger it
3. Test with `/skill-name` direct invocation
4. Confirm `!cmd` injections produce expected output

## Checklist

Use this checklist before considering the skill complete:

- [ ] Intent is clear and specific
- [ ] Model-invocable skills have 2+ quoted natural-language trigger phrases
- [ ] Disabled skills do not advertise broad natural-language triggers
- [ ] Description uses third-person
- [ ] `disable-model-invocation: true` is present, unless autonomous model invocation is intentionally required and documented in the owning plugin's `AGENTS.md`
- [ ] Body uses imperative form
- [ ] Body is 1000-2000 words (or justified if shorter/longer)
- [ ] Single-consumer support material is in this skill's `assets/`
- [ ] Same-plugin shared material is in plugin-level `assets/` and referenced through `${CLAUDE_PLUGIN_DIR}`
- [ ] Cross-plugin sharing has an explicit plugin-boundary decision; unavoidable shared skills live in `mutils`
- [ ] Deterministic tasks are in scripts, not instructions
- [ ] Dynamic context uses `!cmd` where applicable
- [ ] All referenced files exist
- [ ] Scripts have executable permission
- [ ] Validation script passes with no errors
- [ ] Subagent evaluation score is 10/10

## Anti-patterns

- Instructing Claude to "create the directory structure" — Use scaffold script
- Writing validation logic in SKILL.md prose — Create a validation script
- Embedding large reference docs in SKILL.md — Move to `references/` and link
- Vague model-invocable description ("Helps with X") — Specific triggers ("create X", "configure Y")
- Natural-language triggers on a disabled skill — Direct invocation/internal reference wording
- Second-person instructions ("You should...") — Imperative form ("Run...", "Create...")
- Hardcoding paths in SKILL.md — Use `${CLAUDE_SKILL_DIR}` variable
- Slash command for a manual workflow — Skill with `disable-model-invocation: true`
- Separate skill used by only one skill — Owning skill's `assets/` directory
- Same-plugin shared helper skill — Plugin-level `assets/` beside `skills/`
- Manual file permission setting — Script it or document in scaffold
- Hand-editing Bundled Resources section — Re-run `inject-references.ts`

## Bundled Resources

<!-- REFERENCES_START — AUTO-GENERATED by inject-references.ts — DO NOT EDIT MANUALLY -->

### Scripts

- `scripts/detect-context.ts` — Detect the current plugin context for skill creation.
- `scripts/inject-references.ts` — Scan a skill directory and inject a references section into its SKILL.md.
- `scripts/scaffold.ts` — Scaffold a new skill directory with SKILL.md template and optional subdirectories.
- `scripts/validate.ts` — Validate a SKILL.md file for quality and completeness.

### References

- `references/github-api.md` — GitHub API guidelines: use gh auth token + Octokit instead of gh CLI directly
<!-- REFERENCES_END -->
