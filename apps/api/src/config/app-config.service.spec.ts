import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

function createService(values: Record<string, unknown>): AppConfigService {
  const configService = {
    get: <T>(key: string, defaultValue?: T) =>
      (key in values ? values[key] : defaultValue) as T,
    getOrThrow: <T>(key: string) => {
      if (!(key in values)) throw new Error(`Missing required config: ${key}`);
      return values[key] as T;
    },
  } as unknown as ConfigService;
  return new AppConfigService(configService);
}

describe('AppConfigService', () => {
  it('reports isProduction correctly for each NODE_ENV', () => {
    expect(createService({ NODE_ENV: 'production' }).isProduction).toBe(true);
    expect(createService({ NODE_ENV: 'development' }).isProduction).toBe(false);
    expect(createService({ NODE_ENV: 'test' }).isProduction).toBe(false);
  });

  it('throws via getOrThrow-backed getters when a required secret is missing', () => {
    const service = createService({});
    expect(() => service.databaseUrl).toThrow(/DATABASE_URL/);
    expect(() => service.jwtAccessSecret).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => service.jwtRefreshSecret).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('splits a comma-separated CORS_ORIGINS into a trimmed array', () => {
    const service = createService({
      CORS_ORIGINS: 'http://a.com, http://b.com,http://c.com',
    });
    expect(service.corsOrigins).toEqual([
      'http://a.com',
      'http://b.com',
      'http://c.com',
    ]);
  });

  it('falls back to localhost:5173 for corsOrigins when unset', () => {
    const service = createService({});
    expect(service.corsOrigins).toEqual(['http://localhost:5173']);
  });

  it('falls back to sensible defaults for optional values', () => {
    const service = createService({});
    expect(service.port).toBe(3000);
    expect(service.redisUrl).toBe('redis://localhost:6379');
    expect(service.jwtAccessExpiry).toBe('15m');
    expect(service.jwtRefreshExpiry).toBe('30d');
  });
});
