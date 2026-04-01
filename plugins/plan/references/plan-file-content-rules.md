# Plan File Content Rules

This document consolidates the plan file content rules that apply across plan creation and review. These rules ensure that plan files are well-structured, self-contained, and free of unnecessary context dependencies.

## Required Structure

### 1. User Prompts Section

The plan file must begin with a `## User Prompts` heading (before `# Purpose`). Under this heading, all user prompts must be recorded in blockquote (`>`) format, exactly as given, in chronological order. Additional prompts given during planning must also be included in order.

**Example:**

```markdown
## User Prompts

> [First prompt from the user]

> [Second prompt given during planning]

> [Additional prompt if provided during review process]
```

**Guidelines:**

- Place this section at the very top of the file, before `# Purpose`
- Use blockquote (`>`) format for each prompt
- Include ALL prompts given during the planning session, in chronological order
- Include prompts the user provided during the planning process or approval (e.g., feedback, revision requests)
- Do not paraphrase or summarize — copy the exact text as given

### 2. Structure Section

The plan file must include a `## Structure` section with Before/After directory trees. This section visualizes the file system changes that will result from executing the plan.

**Requirements:**

- Show only files and directories relevant to the plan (not the entire project tree)
- Use tree-style notation with indentation for directories and files
- In the "After" section, mark new files/directories with `(new)` and deleted ones with `(delete)`
- If renaming files, show the old name with `(delete)` and new name with `(new)`

**Example:**

```markdown
## Structure

### Before
```

src/
components/
Button.tsx
Modal.tsx

```

### After

```

src/
components/
Button.tsx (delete)
Modal.tsx
Card.tsx (new)

```

```

### 3. Self-Contained Document

The plan file must be a self-contained document that can be executed when given as a standalone file after context reset. It must not assume any shared context.

**Implications:**

- Every instruction in the plan must make sense independently
- Do not rely on external context, previous decisions, or conversation history
- All necessary information must be included in the plan itself
- A developer reading only this file should be able to execute all TODO items

## What to Include

A plan file must include:

- **Purpose section** — Clear, concise description of what the plan aims to achieve
- **Structure section** — Before/After directory and file trees showing the current state and intended target state of relevant files and directories
- **TODO section** — Actionable items with the following required elements:
  - Target file(s) for each task
  - Concrete description of what to do (not abstract goals)
  - All necessary context to execute the task
  - Only actions to be taken after plan approval
- **Verification section** — Verification steps that correspond to each TODO item
- **User Prompts section** — All user prompts in blockquote format (see Required Structure above)

## What NOT to Include

A plan file must NOT contain:

- **Review history or revision traces**
  - Examples to avoid: "revised after review", "based on feedback", "reviewer pointed out", "changed per reviewer suggestion"
  - The plan must not document its own evolution or revision process

- **Revision traces or intermediate states**
  - Only the final intended state should remain
  - All intermediate decision-making should be removed
  - All iteration history must be recorded exclusively in review.md, not in the plan file

- **Things decided not to do or rejected alternatives**
  - Do not document what was considered but ultimately rejected
  - Only include what will be done

- **Context-dependent references**
  - Examples to avoid: "as discussed above", "per the previous round", "as mentioned earlier"
  - These require external context to understand and violate the self-contained principle

- **Anything that would not make sense without the review conversation context**
  - If someone reading the plan alone cannot understand a statement, remove it
  - Move clarifications to the TODO descriptions instead

## Revision Principle

When revising a plan file during review:

1. **Only the final state must remain in the plan file**
   - Remove all intermediate states, drafts, or earlier versions of decisions

2. **All revision history must be recorded exclusively in review.md**
   - Do not leave any traces in the plan file itself
   - Review.md is the appropriate place to document:
     - What issues were found in each round
     - How the plan was revised
     - What feedback was incorporated
     - Why certain changes were made

3. **The plan file should appear as if it was written in its final form**
   - A reader should not be able to detect that the plan was revised through multiple rounds
   - This preserves the plan's self-contained nature and clarity

## Quick Verification Checklist

Before finalizing or approving a plan file, verify all of the following:

### Must Include

- [ ] `## User Prompts` section at the top with all prompts in blockquote format
- [ ] `# Purpose` section with clear goal description
- [ ] `## Structure` section with Before/After directory trees
- [ ] `## TODO` section with actionable items
- [ ] `## Verification` section with items corresponding to TODOs
- [ ] Each TODO item has target file(s) and concrete change descriptions
- [ ] The file is self-contained (makes sense when read in isolation)

### Must NOT Include

- [ ] Review history or revision traces ("revised after review", "based on feedback", etc.)
- [ ] Things decided not to do or rejected alternatives
- [ ] Context-dependent references ("as discussed above", "per the previous round", etc.)
- [ ] Intermediate states or revision history — only the final intended state
- [ ] Any traces of the review or planning conversation within the plan file itself

## Usage

This document is a reference for:

- **plan:define skill** — Use when creating plan files to ensure they comply with these rules
- **plan:review skill** — Use to validate plan file content against these rules during review
- **Policy checkers** — Reference these rules when validating plan files
- **Developers** — Understand the structure and expectations for plan files in this project
