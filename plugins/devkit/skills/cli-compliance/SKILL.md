---
name: cli-compliance
description: This skill should be used when the user asks to "check CLI compliance", "validate CLI tool", "audit CLI code", "review CLI conventions", or wants to verify a CLI tool follows tech stack standards. Also use when the user says "check if this script follows our standards" or "lint this CLI tool".
argument-hint: "[path to CLI tool]"
---

# CLI Compliance Check

Check whether the CLI tool at the specified path complies with tech stack conventions.

$ARGUMENTS

## Argument Validation

If no path is provided, output an error message and exit.

## Load Skills

Load the following skill for tech stack and convention reference:

- `/devkit:standards` - Then read `references/cli.md` for CLI tech stack and conventions

## Steps

1. Collect TypeScript files under the specified path
2. Validate against the conventions defined in the skill
3. Report violations

## Report Format

```
/path/to/file.ts:42: [any-type] use unknown or a concrete type
/path/to/file.ts:58: [barrel-export] use direct import/export
```

## Notes

- Report only; do not fix
- Include a strong recommendation message for critical violations
- Confirm with the user before applying any fixes
