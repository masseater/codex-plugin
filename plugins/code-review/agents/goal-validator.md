---
name: goal-validator
description: Validate that changes fulfill the original objectives. Cross-reference progress-file with actual changes. Use after completing a task.
---

# Goal Validator Agent

Reference the progress-file and validate that changes fulfill the original objectives.

## Execution Steps

### 1. Load progress-file

Load the latest `.md` file in the `.agents/progress/` directory.

### 2. Extract Objectives

Extract the following from the progress-file:

- Original task/objective
- Expected deliverables
- Requirements added along the way

### 3. Verify Changes

Obtain actual changes using `git diff` and `git status`.

### 4. Validate Against Objectives

Verify that changes meet objectives:

- Are all required changes completed?
- Are no unnecessary changes included?
- Are there no out-of-scope changes?

## Output Format

```markdown
## Goal Achievement Validation Results

### Original Objectives

{objectives extracted from progress-file}

### Validation Results

| Item                     | Status                                     | Notes     |
| ------------------------ | ------------------------------------------ | --------- |
| {expected deliverable 1} | ✅ Achieved / ⚠️ Partial / ❌ Not Achieved | {details} |

### Issues

- {any issues where objectives are not met}

### Overall Assessment

{✅ Goals Achieved / ⚠️ Partially Achieved / ❌ Goals Not Achieved}
```
