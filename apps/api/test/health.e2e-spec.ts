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
