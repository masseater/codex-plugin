---
description: CLI tech stack and conventions — Bun, citty, Biome, TypeScript conventions, and code quality examples
---

# CLI Stack

Tech stack and conventions for CLI tool development.

## Tech Stack

All required. Use the latest version at or above the specified minimum.

| Item                  | Technology                        | Version  | Notes                                                                              |
| --------------------- | --------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Language              | TypeScript                        | -        | -                                                                                  |
| Runtime               | Bun                               | -        | -                                                                                  |
| Type checker          | @typescript/native-preview (tsgo) | v7+      | tsc is forbidden — tsgo provides 10x faster type-checking with identical semantics |
| Linter/Formatter      | @biomejs/biome                    | v2+      | -                                                                                  |
| CLI framework         | citty                             | v0.1.6+  | -                                                                                  |
| Colored output        | chalk                             | v5.6.2+  | -                                                                                  |
| Progress bar          | cli-progress                      | v3.12.0+ | -                                                                                  |
| Unused code detection | knip                              | -        | -                                                                                  |

Report missing stack items as critical violations.

## Environment Variables

Use [valibot](https://valibot.dev/) to validate env vars at startup. Define a single `env.ts` module and import from it. Direct `process.env` or `Bun.env` access is forbidden outside `env.ts`.

```typescript
// src/env.ts
import * as v from "valibot";

const EnvSchema = v.object({
  API_TOKEN: v.pipe(v.string(), v.minLength(1)),
  LOG_LEVEL: v.optional(v.picklist(["debug", "info", "warn", "error"]), "info"),
});

export const env = v.parse(EnvSchema, process.env);
```

## TypeScript Conventions

See SKILL.md Philosophy section. Additionally:

- Use `type` instead of `interface` (exception: extending external library types, with a comment)

## Script Conventions

- Create as Bun-executable TypeScript files
- Set shebang for standalone execution
- Use option-style arguments only. No positional arguments.
  - Exception: subcommands are allowed as positional.

```bash
# OK
./hoge.ts

# NG
bun run hoge.ts

# With arguments
# OK
./hoge.ts --fuga "fuga" --piyo

# NG
./hoge.ts "fuga" piyo
```

## Code Quality

See SKILL.md Philosophy section.

### Examples of Dummy Code / NO-OP

```typescript
// NG: function that does nothing
function doSomething() {
  // TODO: implement later
}

// NG: validation that always returns true
function validate(input: string): boolean {
  return true; // no actual validation
}

// NG: swallowing errors
try {
  riskyOperation();
} catch {
  // do nothing
}
```
