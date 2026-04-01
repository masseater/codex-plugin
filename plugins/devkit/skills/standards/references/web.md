---
description: Web stack — Next.js App Router, TanStack Query/Form, shadcn/ui, FSD customization, and dehydrate pattern
---

# Web Stack

| Item                  | Technology                         |
| --------------------- | ---------------------------------- |
| Framework             | Next.js (App Router)               |
| State / Data fetching | TanStack Query (dehydrate pattern) |
| Form                  | TanStack Form + valibot            |
| UI                    | shadcn/ui + Tailwind CSS v4        |

## Environment Variables

Use [t3-env](https://env.t3.gg/) to validate and type all environment variables. Define `env.ts` (or `env.mjs`) at the project root or in `src/`. Import from this module instead of `process.env`.

```typescript
// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import * as v from "valibot";

export const env = createEnv({
  server: {
    DATABASE_URL: v.pipe(v.string(), v.url()),
  },
  client: {
    NEXT_PUBLIC_API_URL: v.pipe(v.string(), v.url()),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
});
```

Direct `process.env` access is forbidden outside `env.ts`.

## FSD Customization (Differences from Standard FSD v2.1)

1. **Early separation** — Separate features/entities early instead of standard FSD's "pages first"
2. **`fsd/insignificant-slice` off** — Slices used by a single page can still live in features/entities
3. **Slice Groups for nesting features** — `features/[domain]/[action]/`
   - Adopts the Slice Groups concept from PR #906
   - Group folders are purely structural (no segments/index.ts of their own)
4. **Next.js + FSD integration** — `app/` for Next.js routing, FSD layers inside `src/`
5. **`shared/` imports use `enforce-barrel-import`** — `fsd/public-api` is off for `shared/`. Instead, the custom `enforce-barrel-import` rule (see `references/quality-automation.md`) enforces: if `index.ts` exists in a directory, import from the directory; otherwise direct file import is allowed

## TanStack Query Dehydrate Pattern

- Per-request QueryClient via `cache()`
- In Server Components: `prefetchQuery` → `dehydrate` → `HydrationBoundary`
- Set staleTime based on data characteristics
- Leverage streaming dehydration from v5.40.0+

## Related Skills

- Also load the `feature-sliced-design` skill for FSD layer structure
- Also load the `tanstack-query-best-practices` skill for query patterns
