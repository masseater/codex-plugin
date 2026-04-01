---
name: code-review:code-review
description: Perform rigorous code review on recently created artifacts. Use when reviewing code quality after implementation.
---

# Perform Rigorous Code Review on Recently Created Artifacts

Review the recently created artifacts to identify issues and fix them.

**Important**: No leniency is tolerated. Conduct code review with strict self-reflection and zero compromises.

$ARGUMENTS

## Execution Steps

### 1. Identify Review Targets

Identify review target files by combining the following information sources:

1. **Check progress files**
   - Read the latest `.md` file in the `.agents/progress/` directory
   - Understand the work content documented in the "Progress" section
   - If a "Conversation" link exists, reference the conversation file (`.jsonl`) to identify edited files

2. **Check git diff**
   - Use `git diff --name-only` and `git diff --staged --name-only` to retrieve changed files
   - Add changed files to the review targets

3. **Files specified as arguments** (if provided)
   - Add file paths specified in arguments to the targets

### 2. Parallel Review by Agents

Launch the following **5 agents in parallel** to conduct reviews from different perspectives:

| Agent                     | Focus                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `design-reviewer`         | Design and architecture (single responsibility, circular dependencies, tight coupling) |
| `implementation-reviewer` | Implementation quality (readability, naming, duplicate code, functional style)         |
| `type-safety-reviewer`    | Type safety (any type prohibition, proper type definitions)                            |
| `ai-antipattern-reviewer` | AI antipatterns (hallucinated APIs, fallback abuse, dead code)                         |
| `goal-validator`          | Goal achievement (cross-reference progress file with changes)                          |

### 3. Fix Issues Directly

Fix all issues found by the agents directly in the local codebase. Do not comment on the PR.

1. Fix critical issues first
2. Fix improvement issues
3. Fix minor issues
4. Only ask the user for confirmation when a fix seems unnecessary or inappropriate

### 4. Verify Fixes

After all fixes are complete:

1. Run `git diff` to verify changes are correct
2. Report a summary of fixes to the user

## Important Notes

- **Never tolerate leniency**: "This is good enough" is prohibited
- **Detect ad-hoc workarounds**: If you find keywords like "temporary", "just for now", "for the moment", "tentatively", or "possibly", write a self-reflection statement of at least 50 characters
- **Strict standards**: Every issue must be addressed with precision and accountability
- **Fix locally, don't comment on PR**: Issues found during review must be fixed in the local codebase, not posted as PR comments
