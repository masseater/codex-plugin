# Design Feedback Generation Guide

Generate feedback for designers about design issues discovered during implementation.

## Format

```markdown
## Design Feedback: {screenName}

### {Issue Title}

**What is the problem**: {State the facts}
**Why it matters**: {Explain user impact}
**Suggestion**: {Propose a solution}
**Screenshot**: {Path if applicable}

### Interim Workaround

{Details of interim implementation (if applied)}
```

## Guidelines

- State facts and impact, not vague judgments like "looks wrong" or "seems off"
- Include at least one suggestion
- If an interim implementation was applied, leave a `// TODO(design):` comment in the code
