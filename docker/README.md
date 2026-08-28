# Docker

- `../docker-compose.yml` — Postgres + Redis + the API, wired with real
  healthcheck-gated `depends_on` (the API container won't start serving
  until both databases report healthy, not just "container running").
- `../apps/api/Dockerfile` — multi-stage build: dependencies → build (runs
  `prisma generate` and `nest build`) → a slim production runtime image
  with dev dependencies excluded and a non-root user.

## Known limitation, documented rather than hidden

This Dockerfile and Compose configuration were written and reviewed for
correctness, but **could not be executed** (`docker compose up`) during
development — the sandbox this Phase 0 delivery was built in has no Docker
daemon available at all (confirmed: `docker: not found`, no nested
containerization). This is specific to that development sandbox, not a
property of the files themselves — any normal machine or CI runner with
Docker installed should build and run these without issue. Please run
`docker compose up --build` as your own first verification step and open
an issue if anything doesn't come up cleanly.
