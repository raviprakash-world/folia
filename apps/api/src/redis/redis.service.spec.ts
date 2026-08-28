import { ConfigService } from '@nestjs/config';
import { AppConfigService } from '../config/app-config.service';
import { RedisService } from './redis.service';

/**
 * Integration test against a real Redis instance (REDIS_URL from the test
 * environment — see test/jest.setup.ts and CI's service container), not a
 * mock. RedisService IS an ioredis client (extends Redis directly), so
 * there's very little meaningful behavior left to test once you've mocked
 * the thing it wraps — this project's standard throughout is to verify
 * against real infrastructure wherever the sandbox allows it.
 */
describe('RedisService (integration)', () => {
  let service: RedisService;

  beforeAll(async () => {
    const configService = {
      get: (key: string, defaultValue?: string) =>
        key === 'REDIS_URL'
          ? (process.env.REDIS_URL ?? 'redis://localhost:6379')
          : defaultValue,
    } as unknown as ConfigService;
    const appConfig = new AppConfigService(configService);
    service = new RedisService(appConfig);
    await service.onModuleInit();
  });

  afterAll(() => {
    service.onModuleDestroy();
  });

  it('connects and responds to PING', async () => {
    expect(await service.ping()).toBe('PONG');
  });

  it('can set and get a real key', async () => {
    await service.set('folia:test:key', 'hello');
    expect(await service.get('folia:test:key')).toBe('hello');
    await service.del('folia:test:key');
  });

  it('respects a TTL on set', async () => {
    await service.set('folia:test:ttl-key', 'value', 'EX', 1);
    const ttl = await service.ttl('folia:test:ttl-key');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1);
    await service.del('folia:test:ttl-key');
  });
});
