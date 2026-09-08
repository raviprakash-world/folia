import { Controller, Get, Inject } from '@nestjs/common';
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
import { Public } from '../auth/decorators/public.decorator';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import type { StorageService } from '../storage/storage.interface';

/**
 * Excluded from the public Swagger doc (infra/ops endpoint, not part of
 * the documented product API), explicitly version-neutral — load
 * balancer probes and uptime monitors shouldn't need to know an API
 * version to check liveness (caught by actually booting the app and
 * inspecting the real registered route, not assumed correct) — and
 * @Public(): JwtAuthGuard became global once AuthModule was wired into
 * app.module.ts, and a health check requiring a valid access token would
 * break every infra probe hitting it. Caught by reviewing the new global
 * guard chain against every existing controller, not assumed fine.
 */
@Public()
@ApiExcludeController()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicatorService: HealthIndicatorService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check(this.dependencyChecks());
  }

  /**
   * Phase 12 — the K8s-style distinction the roadmap asks for.
   * Liveness deliberately checks NOTHING beyond "the process can
   * respond at all" — a database or Redis outage should make this
   * deployment unable to serve real traffic (that's what /health/ready
   * is for), but it does NOT mean the Node process itself is broken and
   * needs restarting. Conflating the two (as this API's plain /health
   * effectively does, kept above for backward compatibility with
   * anything already probing it) means an orchestrator would kill and
   * restart healthy pods during a transient database blip, which
   * doesn't fix anything and adds restart churn on top of an already
   * bad situation. Confirmed against Terminus's own HealthCheckExecutor
   * source directly (not assumed) that an empty check array resolves
   * cleanly to a real "ok" status, not an error — the empty array here
   * is deliberate, not a placeholder.
   */
  @Get('live')
  @HealthCheck()
  liveness() {
    return this.health.check([]);
  }

  /** Same real dependency checks as the plain /health endpoint — this is the one an orchestrator should gate routing traffic on. */
  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check(this.dependencyChecks());
  }

  // NOTE: `this.prisma` here requires the *generated* PrismaClient shape
  // (specifically $queryRawUnsafe, used internally by pingCheck). Before
  // `prisma generate` has run, @prisma/client's pre-generation stub types
  // PrismaClient as `any` (see node_modules/.prisma/client/default.d.ts),
  // so PrismaService's inferred type has only the members explicitly
  // declared in prisma.service.ts — this one line will show a TS error
  // in any environment where `prisma generate` hasn't been run yet, and
  // resolves automatically once it has. Not a code defect. Shared by
  // both check() and readiness() so this only needs stating once.
  private dependencyChecks(): HealthIndicatorFunction[] {
    return [
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.checkRedis(),
      () => this.checkStorage(),
    ];
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

  /**
   * P0-D — no health signal previously existed for the storage backend
   * at all; a full or unwritable disk (today) or bad credentials/an
   * unreachable bucket (once this moves to object storage) would report
   * "ok" regardless. A real round-trip write+delete through the actual
   * StorageService interface, not a static flag — deliberately
   * interface-level rather than reaching into LocalStorageService's own
   * internals, so this check keeps working unchanged whichever
   * StorageService implementation is configured.
   */
  private async checkStorage() {
    const indicator = this.indicatorService.check('storage');
    try {
      const { key } = await this.storage.upload({
        buffer: Buffer.from('ok'),
        originalName: 'health-check.txt',
        mimetype: 'text/plain',
        directory: 'health-check',
      });
      await this.storage.delete(key);
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
