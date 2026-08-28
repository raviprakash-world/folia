import { Type } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Validated at process boot (see validate() below), not lazily on first
 * use — a misconfigured environment (missing DATABASE_URL, an
 * out-of-range PORT, etc.) fails loudly at startup instead of surfacing
 * as a confusing runtime error hours later.
 *
 * Numeric fields need an explicit @Type(() => Number) — relying on
 * plainToInstance's enableImplicitConversion alone was tried first and
 * found NOT to reliably coerce env-var strings to numbers before
 * class-validator's @IsInt() runs (caught by actually booting the app in
 * this environment, not assumed to work), so every numeric field is
 * explicit here rather than relying on implicit reflection metadata.
 */
class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT = 3000;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @IsOptional()
  REDIS_URL = 'redis://localhost:6379';

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_REFRESH_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRY = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRY = '30d';

  @IsString()
  @IsOptional()
  CORS_ORIGINS = 'http://localhost:5173';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const formatted = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${formatted}`);
  }

  return validatedConfig;
}
