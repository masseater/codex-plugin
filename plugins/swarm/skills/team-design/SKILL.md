---
name: team-design
description: Design Agent Teams composition for a task.
disable-model-invocation: true
---

> **REQUIRED**: Use **Agent Teams** for this skill. Do NOT use SubAgent (Agent tool).

# Team Design Guide

## Core Principle: Role-Based Design

Design teams by **role (expertise/perspective)**, not by deliverable.

Why this matters: splitting by deliverable ("skill author" vs "command author") means each artifact gets only one perspective. Splitting by role ("domain expert" vs "UX strategist") means every artifact gets reviewed through multiple lenses. Bugs and design flaws hide from single-perspective reviews — they surface when different experts look at the same artifact.

## Good Role Conditions

1. **Defined by expertise/perspective** — "usability expert" not "frontend developer"
2. **Cross-cutting across all deliverables** — reviews everything, not just specific files
3. **Complementary to other roles** — security expert and performance expert see different things

## Role Templates

### Research / Investigation

| Role                               | When to use                                                          | Responsibility                                                              |
| ---------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `{domain}-domain-expert`           | The task involves a technology with non-obvious specs or constraints | Deep knowledge of the target technology's APIs, limitations, and edge cases |
| `{ecosystem}-ecosystem-specialist` | Prior art exists that should inform the design                       | Patterns from existing tools, plugins, and community conventions            |
| `hypothesis-tester`                | Bug investigation with multiple plausible causes                     | Test one specific theory, actively try to disprove others' theories         |

### Design / Quality

| Role                         | When to use                                                 | Responsibility                                                                                                           |
| ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `user-experience-strategist` | The output has end-user-facing touchpoints                  | User journey, information design, trigger phrases, error messages                                                        |
| `tech-lead`                  | Multiple specialists need coordination                      | Integrates findings into overall design decisions (does not edit files directly)                                         |
| `devils-advocate`            | Groupthink risk is high, or the design needs stress-testing | Actively challenges assumptions, finds edge cases, argues against the current direction to force stronger justifications |
| `naive-user`                 | Discoverability or onboarding matters                       | Validates whether someone with no prior context can understand and use the result                                        |
| `consistent-checker`         | The project has established conventions                     | Checks terminology, interface format, naming conventions for inconsistencies                                             |

### Implementation

| Role                 | When to use                                          | Responsibility                                                     |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ |
| `{stack}-specialist` | The implementation requires deep framework knowledge | Expert in a specific technology stack's patterns and idioms        |
| `test-engineer`      | The deliverable has verifiable acceptance criteria   | Writes and runs tests, validates edge cases, reports coverage gaps |

## Anti-Patterns

### Deliverable-based splitting

| Bad                               | Why                                      | Better                                                          |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| "skill author" + "command author" | Each artifact gets single perspective    | "domain expert" + "UX strategist" who both review all artifacts |
| "frontend dev" + "backend dev"    | Layer ownership, no cross-cutting review | "API design expert" + "security reviewer" across all layers     |
| "file-A owner" + "file-B owner"   | Ownership by file, not by concern        | Roles that review across files from different angles            |

### Too many teammates

More than 5 teammates creates coordination overhead that exceeds the benefit.
Three focused teammates often outperform five scattered ones.
Having 5-6 tasks per teammate is the sweet spot for keeping everyone productive.

### Shared file editing

Two teammates editing the same file leads to overwrites.
Break the work so each teammate owns a different set of files.
If cross-file review is needed, assign a read-only reviewer role (Explore-type work).

### Vague spawn prompts

Teammates do NOT inherit the lead's conversation history.
A spawn prompt that says "implement the auth module" without specifying the tech stack, file locations, constraints, and conventions will produce generic or wrong output.
Include everything the teammate needs to do their job independently.

## Agent Teams vs SubAgent vs Single Session (Reference)

> **Note**: When this skill is invoked, the user has already chosen Agent Teams. This table is for understanding Agent Teams' characteristics, NOT for second-guessing the user's choice.

| Criterion                   | Agent Teams                             | SubAgent              | Single Session |
| --------------------------- | --------------------------------------- | --------------------- | -------------- |
| Tasks parallelizable        | Yes, independently                      | Yes, focused tasks    | Sequential     |
| Workers need to communicate | Yes (teammates message each other)      | No (report back only) | N/A            |
| File conflict risk          | Low (separate file ownership)           | Low                   | None           |
| Token budget                | High (each teammate = separate context) | Medium                | Low            |
| Coordination overhead       | High                                    | Low                   | None           |

**Agent Teams excel when**: teammates need to share findings, challenge each other, and coordinate on their own. The task is complex enough that multiple independent perspectives genuinely add value.

If the task seems better suited for SubAgent or a single session, restructure the approach to leverage Agent Teams' strengths (parallelism, cross-pollination, independent perspectives) rather than suggesting a different tool.
