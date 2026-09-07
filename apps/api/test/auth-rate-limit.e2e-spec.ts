import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * P0-C-3 / P0-C-15 — proves the auth endpoints' per-route @Throttle()
 * decorators actually reject the (N+1)th request within the same 60s
 * window with 429, not just that the decorator is present in source.
 * Each endpoint gets its own it() with a distinct throttler key (a
 * unique email per attempt where the DTO requires one) so one test's
 * requests can't accidentally exhaust another's budget — ThrottlerGuard
 * here keys by client IP + route, and every request in this file shares
 * the same loopback IP, so route separation is what keeps the tests
 * independent within the shared 60s window.
 */
describe('Auth rate limiting (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('register: 6th attempt in a minute is rejected with 429', async () => {
    const suffix = Date.now();
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(server)
        .post('/api/v1/auth/register')
        .send({
          firstName: 'Rate',
          lastName: 'Limit',
          email: `rate-limit-register-${suffix}-${i}@example.com`,
          password: 'Correct1Horse',
        });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('login: 6th attempt in a minute is rejected with 429', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong-password' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('forgot-password: 4th attempt in a minute is rejected with 429', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 4; i++) {
      const res = await request(server)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  it('reset-password: 6th attempt in a minute is rejected with 429', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(server)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'not-a-real-token', password: 'Correct1Horse' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
