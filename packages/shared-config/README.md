# @folia/shared-config

Reserved for shared tooling config (ESLint, TypeScript base config) once
`apps/web` (Vite/React) and `apps/api` (NestJS) have enough genuine overlap
to justify factoring it out. As of Phase 0 their lint/type setups differ
enough (browser vs. Node target, React-specific rules vs. NestJS
decorator-metadata requirements) that a shared base would need per-app
overrides for nearly everything — not worth the indirection yet.
