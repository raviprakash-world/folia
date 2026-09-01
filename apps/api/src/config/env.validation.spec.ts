import { validate } from './env.validation';

const validBaseConfig = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
};

describe('env.validation', () => {
  it('accepts a minimal valid configuration and applies defaults', () => {
    const result = validate({ ...validBaseConfig });
    expect(result.PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
    expect(result.REDIS_URL).toBe('redis://localhost:6379');
  });

  it('coerces a string PORT env var into a number', () => {
    // Regression test — this exact scenario (PORT as a string from
    // process.env) previously failed validation despite being a valid
    // port, until an explicit @Type(() => Number) decorator was added.
    const result = validate({ ...validBaseConfig, PORT: '4000' });
    expect(result.PORT).toBe(4000);
    expect(typeof result.PORT).toBe('number');
  });

  it('rejects a PORT above the valid range', () => {
    expect(() => validate({ ...validBaseConfig, PORT: '99999' })).toThrow(
      /PORT/,
    );
  });

  it('rejects a PORT below the valid range', () => {
    expect(() => validate({ ...validBaseConfig, PORT: '0' })).toThrow(/PORT/);
  });

  it('rejects a non-integer PORT', () => {
    expect(() => validate({ ...validBaseConfig, PORT: '3000.5' })).toThrow(
      /PORT/,
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = validBaseConfig;
    expect(() => validate({ ...rest })).toThrow();
  });

  it('rejects a missing JWT_ACCESS_SECRET', () => {
    const { JWT_ACCESS_SECRET: _omit, ...rest } = validBaseConfig;
    expect(() => validate({ ...rest })).toThrow();
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() =>
      validate({ ...validBaseConfig, NODE_ENV: 'staging-typo' }),
    ).toThrow();
  });

  it('accepts each valid NODE_ENV value', () => {
    for (const env of ['development', 'test', 'production']) {
      expect(() =>
        validate({ ...validBaseConfig, NODE_ENV: env }),
      ).not.toThrow();
    }
  });

  it('accepts a comma-separated CORS_ORIGINS as a raw string (splitting happens in AppConfigService, not here)', () => {
    const result = validate({
      ...validBaseConfig,
      CORS_ORIGINS: 'http://a.com,http://b.com',
    });
    expect(result.CORS_ORIGINS).toBe('http://a.com,http://b.com');
  });

  it('accepts valid JWT expiry duration formats', () => {
    for (const value of ['15m', '1h', '30d', '7 days', '900']) {
      expect(() =>
        validate({ ...validBaseConfig, JWT_ACCESS_EXPIRY: value }),
      ).not.toThrow();
    }
  });

  it('rejects an invalid JWT expiry format (the exact scenario this validation exists to catch)', () => {
    expect(() =>
      validate({ ...validBaseConfig, JWT_ACCESS_EXPIRY: 'fifteen minutes' }),
    ).toThrow(/JWT_ACCESS_EXPIRY/);
  });
});
