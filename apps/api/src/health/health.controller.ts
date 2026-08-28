import { Controller, Get } from '@nestjs/common';
import { VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorFunction,
  HealthIndicatorService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/**
 * Excluded from the public Swagger doc (infra/ops endpoint, not part of
 * the documented product API) and explicitly version-neutral — load
 * balancer probes and uptime monitors shouldn't need to know an API
 * version to check liveness. Caught by actually booting the app and
 * inspecting the real registered route (it came back as `/api/v1/health`
 * under the global versioning config before this fix), not assumed correct.
 */
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicatorService: HealthIndicatorService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    // NOTE: `this.prisma` here requires the *generated* PrismaClient shape
    // (specifically $queryRawUnsafe, used internally by pingCheck). Before
    // `prisma generate` has run, @prisma/client's pre-generation stub types
    // PrismaClient as `any` (see node_modules/.prisma/client/default.d.ts),
    // so PrismaService's inferred type has only the members explicitly
    // declared in prisma.service.ts — this one line will show a TS error
    // in any environment where `prisma generate` hasn't been run yet, and
    // resolves automatically once it has. Not a code defect.
    const checks: HealthIndicatorFunction[] = [
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.checkRedis(),
    ];
    return this.health.check(checks);
  }

  private async checkRedis() {
    const indicator = this.indicatorService.check('redis');
    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: 'Unexpected PING response' });
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
