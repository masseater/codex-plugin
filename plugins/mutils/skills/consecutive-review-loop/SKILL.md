---
name: mutils:consecutive-review-loop
description: "This skill should be used when the user asks for 'N回連続レビュー', '3回連続成功', 'サブエージェントで連続レビュー', 'streak review', 'consecutive review', 'review until N passes', 'レビューが連続成功するまで', or wants iterative subagent review where past feedback MUST NOT leak into the next review. Runs a subagent review-and-fix loop until N consecutive passes are achieved, resetting the streak on any failure and invoking each subagent review with a flat, history-free prompt."
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, TodoWrite, AskUserQuestion
---

# consecutive-review-loop

Run a subagent review-and-fix loop until N **consecutive** passes are achieved. On any failure mid-streak, the counter resets to 0 and the loop restarts from the first attempt. Each subagent review MUST be invoked with a flat, history-free prompt — past feedback MUST NOT be mentioned to the subagent.

`$ARGUMENTS`

## Why The Streak And Flat Prompt Matter

A single passing review is weak evidence — the subagent may have missed issues, or the latest fix may have introduced new ones. N consecutive independent passes is much stronger evidence that the artifact is sound.

For the streak to count as independent evidence, each review MUST be conducted by a subagent that has zero knowledge of previous reviews. If the subagent is told "this is the third attempt, previous feedback was X, Y, Z," it will anchor on past issues and stop looking with fresh eyes. The whole point of the loop collapses.

## Parameters

Resolve these before starting the loop. If `$ARGUMENTS` provides them, use those values; otherwise use defaults or ask the user.

- Review target — yes
  - Default: —
  - Meaning: What artifact the subagent reviews (file path, diagram, design doc, code change, etc.)
- Review focus — yes
  - Default: —
  - Meaning: The single observational frame for the subagent (e.g., "Is this system diagram correct?")
- N (required streak) — no
  - Default: 3
  - Meaning: Number of consecutive passes required to finish
- Pass criterion — no
  - Default: "no actionable findings"
  - Meaning: What makes a review count as a pass

IF: any required parameter is missing AND cannot be inferred from `$ARGUMENTS`; THEN MUST: ask the user with `AskUserQuestion` before starting the loop.

## Workflow

### Algorithm (Pseudocode)

```text
function consecutiveReviewLoop(target, focus, N = 3, passCriterion = "no actionable findings"):
    flatPrompt := buildFlatPrompt(target, focus, passCriterion)   # built ONCE, byte-frozen

    streak   := 0
    attempts := 0

    while streak < N:
        attempts += 1

        result := spawnSubagent(prompt = flatPrompt, model = "sonnet")
                    # MUST NOT pass: streak, attempts, prior findings, prior fixes,
                    #                "this is attempt N", "focus harder on X", etc.

        if result is malformed or subagent crashed:
            continue                          # do NOT count as PASS, do NOT count as FAIL
                                              # re-run the same flatPrompt next iteration

        verdict := classify(result, passCriterion)   # → PASS | FAIL

        if verdict == PASS:
            streak += 1
            report("attempt #" + attempts + ": PASS — streak " + streak + "/" + N)
        else:
            previousStreak := streak
            streak := 0                       # FULL RESET — not streak -= 1
            report("attempt #" + attempts + ": FAIL — streak reset "
                   + previousStreak + " → 0")

            for finding in result.findings:
                applyFix(finding)              # main agent applies fixes directly
            reverifyArtifactValid()            # compile / lint / preview as appropriate

    report("DONE — " + N + " consecutive passes in " + attempts + " attempts")
```

Two invariants the implementation MUST preserve:

1. `flatPrompt` is computed once and reused byte-for-byte across every `spawnSubagent` call.
2. The only state that flows between iterations on the subagent side is **none** — the main agent holds `streak` / `attempts` / findings, the subagent sees only the artifact and the focus.

### Step 1: Set Up State

Track loop state in a TodoWrite list with three items, updated on every iteration:

- `streak: <current>/<N>`
- `attempts: <total attempts so far>`
- `last result: <pass | fail | n/a>`

MUST: update the TodoWrite list after every subagent call and after every fix pass.

### Step 2: Build The Flat Review Prompt (Once)

Write the exact prompt that will be sent to every subagent review. This prompt:

- MUST: describe only the review target and the review focus
- MUST NOT: mention "this is the Nth attempt", "previous feedback", "past iterations", "we have already fixed X", or any history-bearing phrase
- MUST NOT: include the current streak count or attempt number
- MUST NOT: hint at known issues or known-good areas
- SHOULD: ask the subagent to return a structured verdict (PASS / FAIL + findings) so the main agent can classify deterministically

Example skeleton (adapt the framing to the actual target):

> "Review the following [artifact-type]. Check whether it is correct / well-formed / consistent. Return a verdict: PASS if there are no actionable findings, FAIL otherwise. If FAIL, list each finding as a separate bullet."
>
> "[artifact content or path]"

Save this prompt verbatim. MUST: reuse it byte-for-byte on every iteration.

### Step 3: Run The Loop

Repeat until `streak == N`:

1. Spawn a fresh subagent with the verbatim flat prompt from Step 2.
   - MUST: use `Agent` (subagent) — not inline reasoning by the main agent
   - MUST: use `model: sonnet` per the project's subagent rules
   - MUST NOT: add any context about previous iterations, fixes, or findings
   - MUST NOT: vary the prompt across iterations (no "this time look harder", no "focus on X this round")

2. Classify the result as PASS or FAIL based on the pass criterion.

3. Update streak:
   - IF: result == PASS; THEN: `streak += 1`
   - IF: result == FAIL; THEN: `streak = 0` (full reset, even if previous attempts passed)

4. If FAIL: apply fixes for every finding the subagent raised, then continue the loop.
   - MUST: apply fixes by the main agent directly (Write / Edit), not by delegating to a fix subagent
   - MUST: re-verify the artifact is in a valid state before the next review (compile / lint / preview as appropriate)

5. Report progress to the user in one line after each iteration:
   - `attempt #<n>: <PASS|FAIL> — streak <current>/<N>`
   - IF: FAIL after a non-zero streak; THEN MUST: explicitly note the streak reset (e.g., `streak reset 2 → 0`)

6. Stop condition: `streak == N` → declare success and report total attempts.

### Step 4: Report Outcome

When `streak == N` is reached:

- Report total attempts taken
- Report the final artifact state
- MUST NOT: claim success before the N-th consecutive PASS lands

## Rules Summary

- IF: the subagent is being prompted; THEN MUST: send the exact, history-free prompt from Step 2
- IF: a review fails after one or more passes; THEN MUST: reset streak to 0 (not decrement by 1)
- IF: the user interrupts or changes the target mid-loop; THEN MUST: abandon the current streak and restart from Step 1
- MUST NOT: tell the subagent the current streak, attempt index, or what was fixed
- MUST NOT: skip the fix step on FAIL — every actionable finding must be addressed before the next review
- MUST NOT: count a "no-op review" (subagent crashed, timed out, or returned malformed output) as a PASS — re-run the same flat prompt instead

## Anti-patterns

- "This is review #3. Previous reviewers said X, Y. Please verify." — Anchors the subagent on past issues; reviews are no longer independent
- "We've already fixed the diagram arrows. Focus on the labels." — Hides regression risk; the subagent will skip "known-good" areas
- Counting two passes + one fail + one pass as `streak = 1` — Wrong reset semantics — any fail wipes the streak to 0
- Tweaking the prompt wording between iterations to "get a better look" — Each iteration must be byte-identical; otherwise the streak is not measuring the same thing
- Letting the main agent self-review instead of spawning a subagent — Defeats the independence guarantee; the main agent knows the history
- Declaring success after the first PASS — The whole point is N consecutive — one PASS is not enough
