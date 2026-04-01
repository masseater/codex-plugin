# Dismissed Issues Format

This document defines the format for `dismissed-issues.md`, a session-level file that tracks issues dismissed by the parent during plan review triage.

## File Location

```
.agents/sessions/[session-id]/dismissed-issues.md
```

- **Scope**: Session-level (one file per review session)
- **Lifecycle**: Accumulates across rounds — new dismissed issues are appended, never removed
- **Creation**: Created only when the parent dismisses at least 1 issue in Step 3-3 of the review workflow

## File Structure

```markdown
# Dismissed Issues

**Session ID**: [session-id]
**Plan File**: [plan file path]
**Last Updated**: [date/time of last append]

## Summary

| Metric              | Count |
| ------------------- | ----- |
| Total issues raised | [N]   |
| Implemented         | [N]   |
| Dismissed           | [N]   |

## Dismissed Issues Table

| Issue ID | Round | Category         | Issue Summary   | Reason for Dismissal |
| -------- | ----- | ---------------- | --------------- | -------------------- |
| CONS0001 | 1     | Consistency      | [brief summary] | [reason]             |
| GOAL0003 | 2     | Goal Fulfillment | [brief summary] | [reason]             |

## Details

### CONS0001 — [Issue Summary]

- **Round**: 1
- **Reviewer**: consistency-checker
- **Category**: Consistency
- **Full Description**: [full issue description from review.md]
- **Reason for Dismissal**: [detailed explanation of why this issue was dismissed]

### GOAL0003 — [Issue Summary]

- **Round**: 2
- **Reviewer**: goal-fulfillment-checker
- **Category**: Goal Fulfillment
- **Full Description**: [full issue description from review.md]
- **Reason for Dismissal**: [detailed explanation of why this issue was dismissed]
```

## Field Descriptions

| Field                    | Description                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------- |
| **Issue ID**             | Unique identifier from the reviewer report (e.g., CONS0001, PLCY0002, GOAL0003)        |
| **Round**                | The round number in which the issue was raised                                         |
| **Category**             | Issue category from the reviewer (Consistency, Policy, Goal Fulfillment, Design, etc.) |
| **Issue Summary**        | Brief one-line summary of the issue                                                    |
| **Reason for Dismissal** | Why the parent decided not to implement this issue                                     |

## Usage Rules

1. **Append-only**: New dismissed issues are appended to the table and details sections. Existing entries are never modified or removed.
2. **Summary updates**: The Summary section counts are updated each time new issues are appended.
3. **Reviewers receive the path**: In subsequent rounds (Step 3-1), reviewers receive the path to this file so they can see which issues were intentionally dismissed and avoid re-raising them.
4. **plan-updater receives the path**: The plan-updater agent receives this path to build its exclusion list (Step 3-4).

## Example

```markdown
# Dismissed Issues

**Session ID**: 20260301-1430-add-auth
**Plan File**: .agents/plans/add-auth.md
**Last Updated**: 2026-03-01 14:45

## Summary

| Metric              | Count |
| ------------------- | ----- |
| Total issues raised | 5     |
| Implemented         | 3     |
| Dismissed           | 2     |

## Dismissed Issues Table

| Issue ID | Round | Category    | Issue Summary                                     | Reason for Dismissal                                                                         |
| -------- | ----- | ----------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| CONS0002 | 1     | Consistency | Missing error handling for token refresh          | Token refresh is handled by the existing middleware, not the scope of this plan              |
| PLCY0001 | 1     | Policy      | Verification section lacks specific test commands | Test commands will be determined during implementation based on the chosen testing framework |

## Details

### CONS0002 — Missing error handling for token refresh

- **Round**: 1
- **Reviewer**: consistency-checker
- **Category**: Consistency
- **Full Description**: The plan mentions JWT token authentication in the Purpose section but the TODO items do not include error handling for token refresh failures. This could lead to inconsistency between the stated goals and the implementation steps.
- **Reason for Dismissal**: Token refresh is handled by the existing AuthMiddleware class (src/middleware/auth.ts). This plan focuses on adding new authentication endpoints, not modifying the existing refresh flow.

### PLCY0001 — Verification section lacks specific test commands

- **Round**: 1
- **Reviewer**: policy-checker
- **Category**: Policy
- **Full Description**: The Verification section uses vague language like "verify the tests pass" without specifying exact commands to run.
- **Reason for Dismissal**: The testing framework has not been chosen yet (Jest vs Vitest is pending a team decision). Specific commands will be added during implementation when the framework is selected.
```
