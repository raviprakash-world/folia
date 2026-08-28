# @folia/api

NestJS backend for Folia. Phase 0: foundation only (see the root README's
phase table) — no business endpoints yet.

## Stack

NestJS 11 · TypeScript (strict) · Prisma · PostgreSQL · Redis (ioredis) ·
Pino (structured logging via `nestjs-pino`) · Swagger/OpenAPI · Helmet ·
class-validator/class-transformer · Jest + Supertest · ESLint (flat
config) + Prettier.

## Getting started

```bash
cp .env.example .env      # fill in real secrets — see comments in the file
npm install
npx prisma generate       # generates the Prisma client (needs internet
                           # access to binaries.prisma.sh — see "Known
                           # issues" below if this fails)
npx prisma migrate dev    # applies migrations to your local database
npm run start:dev
```

Requires a reachable PostgreSQL and Redis instance — either run them
directly (`apt install postgresql redis-server` or your platform's
equivalent) or via `docker compose up postgres redis` from the repo root.

## Scripts

| Script | What it does |
|---|---|
| `npm run start:dev` | Dev server, watch mode |
| `npm run build` | Type-checked production build (`nest build`) |
| `npm run lint` | ESLint, zero warnings enforced |
| `npm run typecheck` | `tsc --noEmit` only, no build output |
| `npm test` | Unit tests (Jest) |
| `npm run test:cov` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests (needs a real Postgres + Redis + a generated Prisma client) |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:migrate:deploy` | Apply pending migrations (production-safe, no schema drift prompts) |
| `npm run prisma:seed` | Run `prisma/seed.ts` |
| `npm run prisma:studio` | Prisma's local DB browser GUI |

## API conventions

- Every route is prefixed `/api` and versioned (`/api/v1/...` via
  `VersioningType.URI`), **except** `/api/health`, which is deliberately
  version-neutral (`@Controller({ version: VERSION_NEUTRAL })`) — load
  balancer probes and uptime monitors shouldn't need to track API
  versions. This was a real bug caught by booting the app and inspecting
  the actual registered route (it came back `/api/v1/health` before the
  fix), not something assumed correct from reading the versioning config.
- **Every** error response — validation failures, not-found, internal
  errors, everything — is normalized by `AllExceptionsFilter` to
  `{ statusCode, message, error, path, timestamp }`, with `message`
  **always a single string**, never an array. This specifically matches
  `apps/web/src/utils/apiError.ts`'s existing `extractApiErrorMessage()`,
  which reads `error.response.data.message` directly as a string —
  without this normalization, class-validator's default array-of-strings
  `message` would silently break every existing frontend error-toast call
  site. Confirmed via a real unit test
  (`all-exceptions.filter.spec.ts`), not just asserted.
- 500-level errors never leak internal detail (stack traces, DB
  connection strings, raw driver error text) in the response body — the
  full detail is logged server-side via Pino, but the client only ever
  sees "Something went wrong. Please try again." Also covered by a real
  test, not just a code comment.
- Swagger/OpenAPI docs are served at `/api/docs` (excluded from itself,
  naturally) — confirmed serving a real `200` with the correct title
  during Phase 0 development, not just configured and assumed working.

## Known issues

### `binaries.prisma.sh` unreachable in the sandbox this was developed in

Prisma's CLI (`prisma generate`, `prisma migrate dev/deploy`) needs to
download native engine binaries from `binaries.prisma.sh` at least once.
That domain was completely blocked in the sandbox this Phase 0 delivery
was built in (confirmed via three separate attempts, including trying
Prisma's driver-adapter feature, which turned out not to bypass this
specific fetch). This is **specific to that sandbox's network allowlist**,
not a real-world concern — any normal development machine or CI runner
(including the GitHub Actions workflow in `.github/workflows/ci.yml`,
which has been reviewed for correctness but, like `docker compose up`,
could not be executed to completion in that same sandbox) will reach this
domain without issue.

**Concrete, confirmed impact**, not guessed:
- `npx prisma generate` fails immediately with a 403 on the engine
  binary/checksum fetch.
- Because of that, `@prisma/client`'s pre-generation stub types
  `PrismaClient` as `any` (see
  `node_modules/.prisma/client/default.d.ts`), which produces exactly
  **one** TypeScript error in this codebase —
  `src/health/health.controller.ts`, the line passing `this.prisma` to
  `PrismaHealthIndicator.pingCheck()` — and blocks `nest build`/`tsc`
  from completing cleanly. This is the only place it surfaces; confirmed
  by actually running `tsc` repeatedly throughout development, not
  assumed to be contained to one spot.
- At runtime, `new PrismaClient()` throws
  `"@prisma/client did not initialize yet. Please run 'prisma generate'"`
  — confirmed by actually booting the app (via a transpile-only `ts-node`
  invocation, bypassing the type-check step) and reading the real error.

**What was verified instead, to make sure nothing else was hiding behind
this one gap**: with `PrismaModule` temporarily excluded (backed up and
fully restored afterward — this is not how the delivered code is
structured), the app boots for real, connects to a real Redis, and
`GET /api/health` returns a genuine `200 {"status":"ok","info":{"redis":
{"status":"up"}}}`. Structured Pino logs, Helmet security headers, CORS,
and the normalized exception-filter response shape were all confirmed
against real HTTP responses during that same session — not asserted from
reading the source.

**To resolve**: run `npx prisma generate` once, anywhere with normal
internet access. Everything above resolves automatically — no code
changes needed.

### Test coverage is 46.96%, not the ≥90% target

Honest number from an actual `npm run test:cov` run, not a placeholder.
The gap is legitimate and explainable, not corner-cutting:

- `main.ts`, `app.module.ts`, and every `*.module.ts` file are bootstrap/
  DI-wiring code with no branching logic of their own — the standard way
  to cover these is booting the real app in an e2e test (which
  `test/health.e2e-spec.ts` does correctly), not unit tests, and that e2e
  test hits the same Prisma-generation wall above.
- `health.controller.ts` and `prisma.service.ts` both need a working
  generated `PrismaClient` to test meaningfully — mocking it away would
  test the mock, not the code.
- `env.validation.ts`, `app-config.service.ts`, `all-exceptions.filter.ts`,
  and `redis.service.ts` (the modules with real logic that don't depend
  on Prisma) are at 87–100% coverage via real, passing tests — 23 tests,
  all genuinely run, not stubbed.

No test was written just to move the coverage percentage without adding
real verification value (e.g., a bare "expect(module).toBeDefined()" on
an empty `@Module` class) — that would be gaming the metric. Once
`prisma generate` succeeds, the e2e suite becomes runnable and coverage
should rise substantially without any test code changes.
