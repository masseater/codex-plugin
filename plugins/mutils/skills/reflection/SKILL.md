---
name: mutils:reflection
description: "Reflect on what you have been doing in this session and identify what could have been done better"
allowed-tools: Read, Grep, Glob, AskUserQuestion, TodoRead, TodoWrite
---

# Reflection: Analyze What You Have Been Doing and Extract Lessons

Pause and reflect on the work you have been doing up until now in this session. This is not about finding bugs—it's about examining your **approach, decisions, and process** to identify what could have been done differently or better.

`$ARGUMENTS`

## Important Guidelines

- **Be brutally honest**: The point is improvement, not self-congratulation
- **Be specific**: Vague reflections are useless—cite specific examples
- **Focus on controllable factors**: Don't blame external factors; focus on what you could have done differently
- **No excuses**: "I didn't have enough time" is not a valid reflection—the question is what you would prioritize differently
- **Forward-looking**: Every issue identified should have a corresponding lesson or action item

### Unforgivable Anti-patterns

If you did any of the following, you must write a 50+ word self-reflection explaining why it was wrong:

- Used `any` or `unknown` type without explicit justification
- Commented out failing tests instead of fixing them
- Used words like "temporary", "for now", "just in case", "might need later"
- Added fallback/default values without explicit requirements
- Created abstractions for single-use cases
- Copied code instead of extracting shared logic
- Skipped verification before declaring work complete
- Made assumptions without checking actual code or data

## Reflection Step

1. Analyze Each Work Item
2. Generate Reflection Report
3. Self-Critique Questions
4. Ask User for Feedback

## Analyze Each Work Item

For each significant piece of work identified, analyze:

### Process Analysis

- **Initial understanding**: Did I fully understand the requirements before starting?
- **Planning**: Did I plan adequately before implementation?
- **Research**: Did I check existing implementations/libraries before writing new code?
- **Incremental approach**: Did I break down the work into manageable steps?

### Decision Analysis

- **Assumptions made**: What did I assume without verifying?
- **Alternatives considered**: Did I explore multiple approaches?
- **Trade-offs evaluated**: Were trade-offs explicitly considered and documented?
- **Scope creep**: Did I add unnecessary features or complexity?

### Execution Analysis

- **Tool usage**: Did I use the most appropriate tools?
- **Communication**: Did I ask clarifying questions when needed?
- **Verification**: Did I verify my work before declaring it complete?
- **Documentation**: Did I document decisions and rationale?

## Generate Reflection Report

Output a structured reflection in this format:

```markdown
## Work Reviewed

{List of files/tasks that were analyzed}

## What Went Well

- {Specific positive aspects of the approach}

## What Could Have Been Better

### Critical Issues

- **{Issue}**: {Description}
  - What happened: {Specific situation}
  - Better approach: {What should have been done}
  - Lesson: {Takeaway for future work}

### Minor Improvements

- **{Issue}**: {Description}
  - Better approach: {Suggestion}

## Key Lessons Learned

- {Lesson 1}
- {Lesson 2}
- {Lesson 3}

## Action Items for Future Work

- [ ] {Specific actionable improvement}
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Self-Critique Questions

Ask yourself these questions honestly:

- **Did I rush?** Was there pressure (real or perceived) that led to shortcuts?
- **Did I over-engineer?** Did I add complexity that wasn't needed?
- **Did I under-engineer?** Did I take shortcuts that will cause problems later?
- **Did I communicate effectively?** Did I explain my reasoning clearly?
- **Did I verify assumptions?** Or did I proceed on untested beliefs?
- **Did I learn something new?** If not, why not?

## Ask User for Feedback

Use AskUserQuestion to get the user's perspective:

- question: "From your perspective, what aspects of what I have been doing could have been handled better?"
- header: "Feedback"
- options:
  - label: "Approach was fine"
    description: "The overall approach and process was appropriate"
  - label: "Needed more planning"
    description: "Should have planned more before starting implementation"
  - label: "Over-complicated"
    description: "The solution was more complex than necessary"
  - label: "Missed requirements"
    description: "Some requirements were misunderstood or overlooked"
