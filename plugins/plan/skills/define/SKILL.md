---
name: plan:define
description: Use when creating plan files, writing plans, or entering Plan mode. This skill provides a template and checklist for structuring plan files with User Prompts, Purpose, Structure, TODO, and Verification sections that comply with plan file content rules.
---

## Overview

This skill provides a template and checklist for creating plan files. It is separate from Claude Code's `/plan` command (which enters Plan mode). This skill guides the **content** of the plan file to ensure it meets the plugin's quality rules.

## Prerequisite

Enter Plan mode by calling the `EnterPlanMode` tool before using this skill. If already in Plan mode, proceed directly to the Workflow.

## Workflow

1. Create the plan file following the "Plan File Structure Template" below
2. Verify the content against the Plan File Content Rules
3. Run the `plan:review` skill to validate the plan
   - **Important**: During review, the parent MUST read ONLY `review.md` (produced by `plan:review-combiner`). Reading individual reviewer report files is strictly prohibited. The parent MUST always wait for `review-combiner` to complete before reading `review.md`.
4. Once all review issues are resolved, call `ExitPlanMode`

## Plan File Structure Template

Create the plan file with the following structure, in this exact order:

### 1. User Prompts

```markdown
## User Prompts

> [Paste the user's original prompt exactly as given]

> [If additional prompts were given during planning, add them here in order]
```

- Place this section at the very top of the file, before `# Purpose`
- Use blockquote (`>`) format for each prompt
- Include ALL prompts given during the planning session, in chronological order
- Include prompts the user provided during the `ExitPlanMode` approval process (e.g., feedback, revision requests)
- Do not paraphrase or summarize — copy the exact text

### 2. Purpose

```markdown
# Purpose

[Clear, concise description of what this plan aims to achieve]
```

### 3. Structure

```markdown
## Structure

### Before
```

[Directory/file tree showing the current state of relevant files/directories]

```

### After

```

[Directory/file tree showing the target state after plan execution]

```

```

- Show only the files and directories relevant to the plan (not the entire project tree)
- Use tree-style notation (indentation with directories and files)
- In the "After" section, mark new files/directories with `(new)` and deleted ones with `(delete)`
- If renaming, show the old name with `(delete)` and new name with `(new)`

### 4. TODO

```markdown
## TODO

### 1. [Task title]

**Target file**: `path/to/file`

**Description**: [Concrete description of what to do]

### 2. [Task title]

...
```

- Each TODO item must specify target files
- Each TODO item must describe concrete changes
- TODO items must be actionable without additional context
- Only include things that will be done after plan approval

### 5. Verification

```markdown
## Verification

1. [Verification item corresponding to TODO 1]
2. [Verification item corresponding to TODO 2]
   ...
```

## Plan File Content Rules

See [Plan File Content Rules](../../references/plan-file-content-rules.md)

## Handling Additional Prompts During Planning

When additional prompts are received while creating the plan:

1. **Add to User Prompts section**: Append the new prompt as a new blockquote entry, maintaining chronological order
2. **Update TODO**: Add, modify, or remove TODO items as needed to reflect the new prompt
3. **Update Structure**: Update Before/After trees if new prompts affect file structure changes
4. **Update Verification**: Add corresponding verification items for any new TODOs
5. **Keep the file clean**: The plan file should always reflect only the final intended state, not the evolution of decisions
