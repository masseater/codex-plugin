---
name: mutils:dig
description: 'This skill should be used when the user asks to "clarify the plan", "ask detailed questions", "曖昧な点を詰めて", "計画を深掘り", or wants structured questions that resolve unclear points in a plan file.'
allowed-tools: Write, Edit, Read, Grep, Glob, TodoRead, TodoWrite, AskUserQuestion
---

Read the current plan file and interview me in detail using the AskUserQuestionTool about literally anything.

- Product Spec
- Technical detail
- UI/UX
- and anything

MUST: follow these phases in order:

1. Clarify unclear point
2. Ask user question to make a decision
3. Apply decision to plan
4. Show the summary to the user

- MUST: keep digging in-depth until every unclear point is resolved, then write the spec to the plan file
- IF: phase 3 is complete; THEN MUST: revisit the plan file, analyze it, and if any unclear point remains, return to phase 2

### Phase 2: Generate Questions

<rules>
- MUST: ask 2-4 questions (adjust based on ambiguity level)
- MUST: give each question 2-4 concrete options
- MUST: include brief pros/cons in each option
- MUST NOT: ask open-ended questions (use concrete options instead)
- MUST NOT: include an "Other" option (it is auto-added)
- IF: CLAUDE.md is available; THEN MUST: align options with its existing patterns
</rules>

### Phase 3: Post-Answer Processing

<output_format>
After receiving user answers, output:

## Decisions

- Data storage — Database
  - Reason: Scalability needs
  - Notes: Consider migration strategy

## Next Steps

1. First task
   - Details...
2. Second task
   - Details...
     </output_format>

---

## Important Notes

- MUST: use the AskUserQuestion tool; MUST NOT: ask conversational questions instead
- Language selection:
  1. IF: CLAUDE.md states a language preference (e.g., "respond in Japanese"); THEN MUST: use that language
  2. IF: no preference is found; THEN MUST: use English
- MUST: include pros/cons in each option
- SHOULD NOT: use multiSelect (default: false; use it only when answers are genuinely non-exclusive)
- IF: generating questions; THEN MUST: read CLAUDE.md first to align with project patterns
