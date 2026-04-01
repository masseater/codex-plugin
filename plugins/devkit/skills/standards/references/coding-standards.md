---
description: Cross-stack coding standards — environment variable validation patterns and other concrete conventions that apply to all stacks
---

# Coding Standards

Concrete patterns that implement Philosophy principles across all stacks.

## Environment Variable Validation

Never use `skipEnvValidation` (or any option that disables validation). Validation must always run. When you need to bypass real values (CI, lint, typecheck), inject dummy environment variables instead.

### `isDummy` and `DUMMY_ENV`

Two constants work together:

- **`isDummy`** — boolean flag that determines whether dummy injection is active
- **`DUMMY_ENV`** — object containing dummy values for all required env vars, passed to `runtimeEnv` as a substitute for `process.env`

When writing the `isDummy` condition, always place the conditions that **must return false** first (guards), then the conditions where dummy injection is acceptable:

```ts
// env.ts

const isDummy =
  // --- MUST return false: production never gets dummies ---
  process.env.NODE_ENV !== "production" &&
  // --- May return true: CI, lint, typecheck, etc. ---
  (process.env.CI === "true" || !process.env.DATABASE_URL);

const DUMMY_ENV = {
  DATABASE_URL: "postgresql://dummy",
  REDIS_URL: "redis://dummy",
} as const;

const runtimeEnv = isDummy ? DUMMY_ENV : process.env;

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
  },
  runtimeEnv,
});
```

```ts
// Bad: skipping validation entirely — never do this
export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  // ...
});
```

Why the guard ordering matters: the `!== "production"` check short-circuits first, so production can never receive dummy values regardless of what other conditions evaluate to.
