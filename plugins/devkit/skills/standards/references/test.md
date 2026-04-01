---
description: Test policy — Vitest framework, Storybook visual testing with CSF factories, co-located files, what to test, mocking strategy, and coverage expectations
---

# Test Policy

## Tools

| Item              | Technology                                            |
| ----------------- | ----------------------------------------------------- |
| Test framework    | Vitest                                                |
| Visual testing    | Storybook (CSF factories format)                      |
| Test file naming  | `[name].test.ts` (co-located with source file)        |
| Story file naming | `[name].stories.tsx` (co-located with component file) |

## Test File Placement

Place test files next to the source file they test: `foo.ts` → `foo.test.ts`, `button.tsx` → `button.stories.tsx`. Do NOT use `__tests__/` or `__test__/` directories — co-location keeps navigation simple and makes dead code detection easier.

## What to Test

| Test                          | Why                                                  |
| ----------------------------- | ---------------------------------------------------- |
| Public API of each module     | Catches regressions at the boundary others depend on |
| Business logic with branching | Branches are where bugs hide                         |
| Error paths and edge cases    | Verifies fail-fast behavior matches expectations     |
| Data transformations          | Input → output assertions are cheap and high-value   |

Do NOT test:

- Framework internals (React rendering, Next.js routing) — the framework tests these
- Implementation details (private functions, internal state) — tests should survive refactors
- Simple pass-through functions with no logic

## Mocking Strategy

| Approach                      | When                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| No mock (real implementation) | Default. Use real code whenever possible                     |
| Dependency injection          | Prefer over mocking. Pass dependencies as arguments          |
| `vi.mock()`                   | Last resort. Only for external I/O (network, filesystem, DB) |

Never mock what you own. If you need to mock an internal module, the design has a coupling problem — fix the design instead.

## Test Naming

Use descriptive `test()` or `it()` names that state the expected behavior:

- `test("returns empty array when no items match filter")` — good
- `test("filter works")` — too vague
- `test("test1")` — forbidden

## Prohibited Patterns

Enforce via ESLint rules in `references/quality-automation.md`.

### Vague Matchers

| Matcher         | Why prohibited                                                                        | Use instead                                       |
| --------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `toBeTruthy()`  | Passes for `1`, `"str"`, `[]`, `{}` — almost never what you mean                      | `toBe(true)` for booleans, or a specific matcher  |
| `toBeFalsy()`   | Passes for `0`, `""`, `null`, `undefined`, `NaN` — hides which falsy value you expect | `toBe(false)` for booleans, or a specific matcher |
| `toBeDefined()` | Only checks `!== undefined` — passes for `null`, `0`, `""`, `false`                   | Assert the specific expected value                |

### Shared Mutable State

| Pattern                    | Why prohibited                                                                        | Use instead                                                  |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `let` in test files        | Shared mutable state couples tests — one test's mutation leaks into the next          | `const` with `test.extends` fixtures or inline setup         |
| `beforeEach` / `afterEach` | Implicit setup hidden from the test body — reader must scroll to understand context   | `test.extends` fixtures for shared setup, inline for one-off |
| `beforeAll` / `afterAll`   | Same implicit coupling; expensive shared resources should use `test.extends` fixtures | `test.extends` fixtures                                      |

### test.extends — Fixture Pattern

Use `test.extends` to declare per-test fixtures. Each test receives a fresh instance via destructuring — no shared mutable state, no lifecycle hooks.

```typescript
import { test as base, expect } from "vitest";

const test = base.extends<{ db: Database }>({
  db: async ({}, use) => {
    const db = await createTestDatabase();
    await use(db);
    await db.cleanup();
  },
});

test("inserts a record", async ({ db }) => {
  await db.insert({ id: 1, name: "foo" });
  expect(await db.findById(1)).toEqual({ id: 1, name: "foo" });
});

test("returns null for missing record", async ({ db }) => {
  expect(await db.findById(999)).toBeNull();
});
```

Key points:

- Each test gets its own `db` — no leaking between tests
- Setup and teardown are co-located in the fixture definition
- Tests only destructure the fixtures they need — unused fixtures are not instantiated
- Compose fixtures by extending an already-extended `test`

### Automatic Fixtures (`auto: true`)

When a fixture must run for every test but is never referenced in the test body (e.g., database seeding, metrics collection), use the tuple syntax with `{ auto: true }`. This makes the fixture run automatically regardless of whether the test destructures it — no underscore-prefixed unused variables needed.

```typescript
import { test as base, expect } from "vitest";

const test = base.extend<{ db: Database }>({
  db: [
    async ({}, use) => {
      const db = await createTestDatabase();
      await use(db);
      await db.cleanup();
    },
    { auto: true },
  ],
});

// db setup/teardown runs even though the test does not destructure it
test("server responds with 200", async () => {
  const res = await fetch("/api/health");
  expect(res.status).toBe(200);
});
```

| Pattern                                   | Verdict    | Why                                                                           |
| ----------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `test("x", ({ _db }) => {})`              | Prohibited | Underscore-prefixed unused variable is a lint-silencing hack — unclear intent |
| `test("x", ({ db: _db }) => {})`          | Prohibited | Same — renaming to suppress lint hides the real problem                       |
| `test("x", ({ db }) => { /* no use */ })` | Prohibited | Destructuring a fixture you never reference is unnecessary noise              |
| Define the fixture with `{ auto: true }`  | Required   | Fixtures not referenced in the test body must use `auto: true`                |

## Coverage

Set a project-level coverage threshold and enforce it in CI. The threshold is defined per project (e.g., 80% line coverage) and must be met before a PR can merge. Coverage measurement must include both unit tests and Storybook visual tests — a component covered only by stories still counts toward the threshold, and vice versa.

Configure Vitest to collect coverage from Storybook interaction tests via `@storybook/experimental-addon-test`. This ensures stories with `play` functions contribute to the same coverage report as unit tests.

Require tests for every new module and every bug fix (regression test). Enforce with a CI check or lint rule that verifies new `.ts` source files have a corresponding `.test.ts` file and new component files have a corresponding `.stories.tsx` file.

## Storybook — Visual Testing

Use Storybook for component-level visual testing and documentation. Every UI component must have a co-located `.stories.tsx` file.

### CSF Factories Format (Required)

All stories must use the CSF factories format. Do NOT use legacy CSF 1/2/3 syntax (`export default { ... }` with `satisfies Meta`).

#### Setup

1. **Subpath import** — Add to `package.json`:

```json
{
  "imports": {
    "#*": ["./*", "./*.ts", "./*.tsx"]
  }
}
```

2. **Main config** — Use `defineMain` in `.storybook/main.ts`. Choose the framework package based on your project:

| Project type                | Framework package       |
| --------------------------- | ----------------------- |
| Next.js (default web stack) | `@storybook/nextjs`     |
| React + Vite                | `@storybook/react-vite` |

**Next.js projects** (use this by default — see `references/web.md`):

```typescript
// .storybook/main.ts
import { defineMain } from "@storybook/nextjs/node";

export default defineMain({
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-essentials", "@storybook/experimental-addon-test"],
});
```

**React + Vite projects** (non-Next.js):

```typescript
// .storybook/main.ts
import { defineMain } from "@storybook/react-vite/node";

export default defineMain({
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-essentials", "@storybook/experimental-addon-test"],
});
```

3. **Preview config** — Use `definePreview` in `.storybook/preview.ts`:

**Next.js projects** (use this by default):

```typescript
// .storybook/preview.ts
import { definePreview } from "@storybook/nextjs/preview";

export default definePreview({
  parameters: {
    nextjs: {
      appDirectory: true, // Enable App Router support
    },
  },
});
```

This ensures `next/image`, `next/link`, `next/navigation`, and other Next.js modules work correctly inside stories. Without this configuration, components using Next.js features will throw runtime errors in Storybook.

**React + Vite projects** (non-Next.js):

```typescript
// .storybook/preview.ts
import { definePreview } from "@storybook/react-vite/preview";

export default definePreview({});
```

#### Writing Stories

```typescript
import preview from "#.storybook/preview";
import { Button } from "./button";

const meta = preview.meta({
  component: Button,
});

export default meta;

export const Primary = meta.story({
  args: { variant: "primary", children: "Click me" },
});

export const Secondary = meta.story({
  args: { variant: "secondary", children: "Click me" },
});

// Reusing args from another story via .composed
export const Large = meta.story({
  args: { ...Primary.composed.args, size: "lg" },
});
```

Key rules:

- Import preview via subpath import (`#.storybook/preview`), never relative paths
- Use `preview.meta()` for component metadata, `meta.story()` for individual stories
- Access composed values (args merged from preview → meta → story) via `.composed`
- No manual type annotations (`satisfies Meta`, `StoryObj`) — types are inferred automatically
- Add `play` functions for interaction tests — these contribute to coverage
