---
description: Backend tech stack — Hono framework, Drizzle ORM, better-auth, awilix, environment validation, and error handling conventions
---

# Backend Stack

| Item           | Technology                     |
| -------------- | ------------------------------ |
| Framework      | Hono                           |
| ORM            | Drizzle ORM                    |
| Auth           | better-auth (Google OAuth 2.0) |
| DI             | awilix                         |
| Env validation | t3-env                         |
| Error handling | Fail fast (see Philosophy)     |

## Hono

- Use Hono as the default backend framework for all new projects
- Deploy target: Cloudflare Workers first, Node.js adapter as fallback
- Use `Hono` factory with `app.route()` for modular route registration — one file per resource
- Use Hono RPC (`hc`) for type-safe client generation — share types between frontend and backend
- Use Hono middleware (`app.use()`) for cross-cutting concerns (auth, logging, error handling)
- Use `@hono/valibot-validator` for request/response validation with valibot schemas
- Use `c.var` with typed context (`new Hono<{ Variables: AppVars }>()`) for dependency injection per request

## Drizzle ORM

- Define schema in `src/db/schema/` with one file per table or domain group
- Use Drizzle Kit for migrations (`drizzle-kit generate` → `drizzle-kit migrate`)
- Never write raw SQL for CRUD — use Drizzle query builder
- Define relations in schema files alongside table definitions

## better-auth

- Configure providers in a single `src/auth.ts` module
- Use Google OAuth 2.0 as the default provider
- Store session in the database (not JWT-only) for revocability

## awilix

- Create one container per request (scoped lifetime) — not a singleton
- Register dependencies with `asFunction()` or `asClass()` — avoid `asValue()` for services
- Define the container setup in a single `src/container.ts` module

## Environment Variables

Use [t3-env](https://env.t3.gg/) to validate and type all environment variables. Define a single `env.ts` module and import from it. Direct `process.env` access is forbidden outside `env.ts`. For non-Next.js backends, use `@t3-oss/env-core` (not `@t3-oss/env-nextjs`). Never use `skipEnvValidation` — see `references/coding-standards.md` for the dummy injection pattern.

## Error Handling

Follow fail-fast from Philosophy:

- Let errors propagate to the top-level error handler — do not catch-and-ignore
- Use typed error classes for domain errors (not generic `Error`)
- Return appropriate HTTP status codes from the error handler — do not return 200 for errors
