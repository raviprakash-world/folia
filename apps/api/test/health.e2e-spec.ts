import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * Boots the real AppModule (real Prisma + Redis connections, per this
 * project's "verify against real infrastructure, not mocks" standard —
 * see ARCHITECTURE.md) and hits the actual health endpoint end-to-end.
 * Requires DATABASE_URL/REDIS_URL pointing at reachable instances and a
 * successfully generated Prisma client (see the root README's "Known
 * issues" if this fails with a PrismaClient initialization error).
 *
 * P0-B (tooling) note — why test/jest-e2e.json sets `forceExit: true`:
 * booting the real AppModule pulls in JobsModule, whose
 * `BullModule.forRootAsync` factory creates its own bare `new
 * Redis(...)` connection for BullMQ (jobs.module.ts) rather than an
 * injected, Nest-lifecycle-managed provider — nothing ever calls
 * `.quit()`/`.disconnect()` on it, on this test's own `app.close()` or
 * on a real SIGTERM. Confirmed by direct code inspection, not
 * `--detectOpenHandles` (that diagnostic printed inconsistently across
 * runs — a timing artifact of ioBusy which handle happens to still be
 * open when Jest's post-run scan fires — but the underlying leak itself
 * reproduced on every run). This is a real, narrow connection-lifecycle
 * defect — the same category as the rest of graceful shutdown
 * (`enableShutdownHooks()` is never called in main.ts either) — and is
 * explicitly out of scope for the P0-B tooling phase; `forceExit` here
 * only lets the TEST RUNNER exit once real test results are already in,
 * it does not affect what those results are. Fix belongs to the
 * graceful-shutdown phase: give JobsModule's BullMQ connection its own
 * injectable provider with a real `onModuleDestroy`, matching
 * PrismaService/RedisService's existing pattern.
 */
describe('Health (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' }); // must match main.ts
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /api/health returns 200 with database and redis both up', async () => {
    const response = await request(server).get('/api/health').expect(200);
    const body = response.body as {
      status: string;
      info: { database: { status: string }; redis: { status: string } };
    };
    expect(body.status).toBe('ok');
    expect(body.info.database.status).toBe('up');
    expect(body.info.redis.status).toBe('up');
  });

  it('GET /api/health is version-neutral, not prefixed with /v1', async () => {
    await request(server).get('/api/v1/health').expect(404);
  });
});
