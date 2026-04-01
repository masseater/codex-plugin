---
name: plan:review
description: Use when the user asks to "review the plan", "check plan quality", "validate the plan before ExitPlanMode", or "run plan review". This skill coordinates parallel review from multiple specialized sub-agents and iterates until 3 consecutive rounds of unanimous approval are achieved.
---

## Overview

Review a plan file from multiple perspectives before ExitPlanMode. The 3-consecutive-round requirement ensures that fixes to one issue do not introduce new problems — each round validates both the original plan and all revisions made.

## Workflow

### Step 1: Reviewer Selection

1. **Required agents**
   - `plan:consistency-checker` (checks plan consistency and completeness)
   - `plan:policy-checker` (checks plan file content rule conformance)
   - `plan:goal-fulfillment-checker` (checks whether the plan fulfills user goals)

2. **Additional agents** (select at least one based on plan content, for a minimum of 4 reviewers total)
   - **For general implementation plans** -> `voltagent-qa-sec:architect-reviewer`
     - Use when: general design and architecture perspective is needed

   - **For code quality focus** -> `voltagent-qa-sec:code-reviewer`
     - Use when: code implementation quality and best practices perspective is needed

   - **For TypeScript plans** -> `code-review:type-safety-reviewer`
     - Use when: TypeScript type definitions and type safety are important

   - **For design and architecture focus** -> `code-review:design-reviewer`
     - Use when: system design and architecture patterns are the priority

   - **For goal achievement focus** -> `code-review:goal-validator`
     - Use when: alignment with user requirements and business objectives needs verification

### Step 2: Generate Session ID

mutils:session-id スキルの `generate.ts` を実行して session-id を生成し、`.agents/sessions/[session-id]/` ディレクトリを作成する。

### Step 3: Run Parallel Reviews (until 3 consecutive all-APPROVE rounds)

Maintain a consecutive APPROVE counter (starts at 0). For each round (repeat until termination condition is met), perform the following:

#### Step 3-1. Launch reviewers in parallel

Launch all reviewers simultaneously using Task tool calls. Each reviewer receives:

- The plan file path
- The output file path: `.agents/sessions/[session-id]/rounds/[NNNN]/[agent-name]-review.md`（session-id は mutils:session-id スキルを使用）
- **Round 2 and beyond**: dismissed-issues.md path (if it exists): `.agents/sessions/[session-id]/dismissed-issues.md`

Each reviewer writes its report to the specified output path using the `Write` tool.

**← Wait for ALL reviewers to complete before proceeding to Step 3-2.**

#### Step 3-2. Aggregate results via review-combiner

Launch `plan:review-combiner` to record the round results in review.md.

Provide:

- review.md path
- Round number
- Reviewer report file paths

**← Wait for review-combiner to complete. Do NOT proceed until review-combiner has finished.**

**← Read review.md (and ONLY review.md) to obtain round results. Do NOT read individual reviewer report files.**

Apply the following decision logic based on the Round Summary in review.md:

```
Decision logic:

1. All reviewers APPROVE
   -> Increment consecutive APPROVE counter
   -> If counter reaches 3, proceed to Step 4 (completion report)
   -> Otherwise, proceed to next round (Step 3-1)

2. One or more REQUEST_CHANGES
   -> Reset consecutive APPROVE counter to 0
   -> Proceed to Step 3-3

3. Invalid or unclear report
   -> Treat as REQUEST_CHANGES and request resubmission from the reviewer
```

**Important**: The parent reads ONLY review.md to make decisions. Do NOT read individual reviewer report files directly.

#### Step 3-3. Issue disposition (parent has NO dismiss authority)

Read ALL REQUEST_CHANGES issues from review.md (current round's Detailed Reviews section).

**Critical constraint**: The parent session CANNOT dismiss any issue on its own. Only `plan:review-claim-verifier` can invalidate a reviewer's claim.

For each issue, choose one of the following:

1. **WILL_IMPLEMENT** — Accept the issue. It will be applied by plan-updater.
2. **VERIFY** — Delegate to `plan:review-claim-verifier` to determine whether the claim is correct.

There is no DISMISS option for the parent. To dismiss an issue, the parent MUST go through VERIFY.

**VERIFY procedure**:

1. Launch `plan:review-claim-verifier` for each VERIFY issue (can be launched in parallel)
2. Wait for all claim-verifier agents to complete
3. Map results mechanically — no reinterpretation allowed:
   - `CLAIM_VALID` → WILL_IMPLEMENT (the claim is correct, so the issue must be addressed)
   - `CLAIM_INVALID` → DISMISS (the claim is incorrect, so the issue is rejected)

**Completeness check**: After disposition, verify that the count of (WILL_IMPLEMENT + DISMISS) equals the total number of REQUEST_CHANGES issues in review.md. If the count does not match, re-read review.md and account for all missing issues.

If there are any DISMISS decisions (from CLAIM_INVALID results only), create or append to `.agents/sessions/[session-id]/dismissed-issues.md`:

- This is a session-level file that accumulates across rounds
- See [Dismissed Issues Format](../../references/dismissed-issues-format.md) for the file format

#### Step 3-4. Launch plan-updater

If there is at least 1 WILL_IMPLEMENT issue:

1. Launch `plan:plan-updater` with:
   - Plan file path
   - review.md path
   - Round number
   - dismissed-issues.md path (if it exists)

2. **← Wait for plan-updater to complete.**

3. The parent does NOT edit the plan file directly. Only plan-updater modifies the plan file.

If there are 0 WILL_IMPLEMENT issues (all were DISMISS), proceed to Step 3-5 to record the dismissals in review.md, then continue to Step 3-6.

#### Step 3-5. Record revisions via review-combiner

Launch `plan:review-combiner` to record the revision and dismissal details:

Provide:

- review.md path
- Round number
- plan-updater revision report path (if plan-updater was launched): `.agents/sessions/[session-id]/rounds/[NNNN]/plan-updater-revision-report.md`
- dismissed-issues.md path (if it exists): `.agents/sessions/[session-id]/dismissed-issues.md`

review-combiner reads these files itself and appends the Round Revisions table and Dismissed Issues section to review.md. This step is required even when all issues were dismissed (no plan-updater was launched), to ensure review.md has a complete record of every round.

**← Wait for review-combiner to complete. Do NOT proceed until review-combiner has finished.**

#### Step 3-6. Transition to next round

1. Update round counter to N+1
2. Reset consecutive APPROVE counter to 0
3. Next round reviewers receive ONLY:
   - Updated plan file path
   - dismissed-issues.md path (if it exists)
   - Output file path for their report
4. **No inline issue descriptions or revision summaries are passed to reviewers.**

### Step 4: Completion Report

#### 4-1. Create result summary

Present the result summary to the user in the following format:

```markdown
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Plan Review Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Plan File**: [path]
**Review Status**: All Approved
**Total Rounds**: [number of rounds]

### Results by Round

| Round   | Status   | Reviewers                | Verdict   |
| ------- | -------- | ------------------------ | --------- |
| Round 1 | [status] | consistency-checker, ... | [verdict] |
| Round 2 | [status] | ...                      | [verdict] |
| Round 3 | [status] | ...                      | [verdict] |

### Individual Reviewer Verdicts

- consistency-checker: APPROVE
- architect-reviewer: APPROVE
- goal-validator: APPROVE
```

#### 4-2. Finalize review.md

Launch `plan:review-combiner` with final round flag to append the Final Status section.

#### 4-3. When consensus has not been achieved

If 3 consecutive all-APPROVE rounds have not been achieved and forward progress has stalled:

1. **Report to user**

   ```
   Multiple rounds of review have been completed, but 3 consecutive all-APPROVE rounds have not been achieved. The following issues remain unresolved:

   [List unresolved issues]

   Options:
   1. Revise the plan file and run the review again
   2. Approve addressing some issues after work begins
   3. Substantially revise the plan
   ```

2. **Wait for user instruction**
   - Ask for the user's decision using the AskUserQuestion tool

## Plan File Content Rules

See [Plan File Content Rules](../../references/plan-file-content-rules.md)

## Important Notes

### Parent has NO dismiss authority

- **The parent session cannot dismiss or skip any reviewer issue on its own.** The only path to dismissal is through `plan:review-claim-verifier` returning `CLAIM_INVALID`.
- **Default to WILL_IMPLEMENT**: When the parent has no objection to a reviewer's claim, choose WILL_IMPLEMENT directly. Do not verify claims you agree with — only verify claims you want to challenge.
- **Mechanical mapping of claim-verifier results**: `CLAIM_VALID` → WILL_IMPLEMENT, `CLAIM_INVALID` → DISMISS. The parent must not reinterpret, qualify, or override these results under any circumstances.
- **Completeness enforcement**: Every issue in review.md must be accounted for. The parent must verify that (WILL_IMPLEMENT count + DISMISS count) = total issue count before proceeding.

### Synchronization rules

- Every sub-agent launch MUST be followed by waiting for its completion before proceeding to the next step
- The parent MUST NOT proceed to the next step until ALL sub-agents launched in the current step have completed
- This applies to all steps: reviewers (3-1), review-combiner (3-2, 3-5, 4-2), plan-updater (3-4)

### File-based communication

- All communication between parent and sub-agents is done through files
- **The parent MUST read ONLY review.md to obtain review results — reading individual reviewer report files is strictly prohibited**
- **The parent MUST always wait for review-combiner to complete before reading review.md**
- Reviewers write APPROVE or REQUEST_CHANGES in their report files, but these are consumed by review-combiner, not by the parent
- plan-updater uses review.md as the sole source of truth for changes

### review-combiner is the mandatory intermediary

- The parent MUST NOT read individual reviewer report files under any circumstances
- The parent MUST wait for `plan:review-combiner` to complete at every invocation point (Steps 3-2, 3-5, and 4-2)
- The only file the parent reads for review decisions is `review.md`, which is produced and maintained exclusively by `review-combiner`
- If review-combiner fails or produces incomplete output, the parent must re-launch review-combiner rather than falling back to reading individual reports

### Plan file editing restriction

- The parent MUST NOT edit the plan file directly
- Only the `plan:plan-updater` agent may modify the plan file
- plan-updater's sole source for what to change is review.md (created by review-combiner)

### Strict format validation

If a report's format is invalid (missing required sections, unclear verdict value, etc.), automatically treat it as REQUEST_CHANGES and request resubmission.

## Usage Examples

### Basic usage flow

```
1. Create a plan file in Plan mode
2. Load this skill (review)
3. Follow the review skill instructions to run multiple rounds of review
4. Obtain APPROVE from all reviewers
5. Run ExitPlanMode to finalize the plan
```

### Example notification to user

```
Starting plan review.

**Plan File**: [path]
**Selected Reviewers**:
  - plan:consistency-checker
  - plan:policy-checker
  - voltagent-qa-sec:architect-reviewer
  - code-review:goal-validator

**Number of agents**: 4
**Termination**: 3 consecutive all-APPROVE rounds

Ready. Starting review now.
```
