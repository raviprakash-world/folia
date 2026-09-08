import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

/**
 * P0-D — the connection JobsModule's BullMQ queues run on, extracted into
 * its own injectable provider so Nest's OnModuleDestroy lifecycle can
 * actually close it. Previously `jobs.module.ts`'s `BullModule.forRootAsync`
 * factory created a bare `new Redis(...)` inline and handed it to BullMQ —
 * nothing ever called `.quit()`/`.disconnect()` on it, so it stayed open
 * past `app.close()`, keeping the event loop alive indefinitely. Confirmed
 * live in Docker: once `app.enableShutdownHooks()` and the Dockerfile's
 * `exec` fix (see both files' own comments) finally let SIGTERM reach and
 * be acted on by the process, the app correctly started failing its
 * readiness check but then never actually exited — Docker had to SIGKILL
 * it after the stop-grace-period every time. This is the other half of
 * that same fix, not a separate issue.
 *
 * A separate connection from RedisService's own (not a shared instance) —
 * deliberately, unchanged from the original code: BullMQ requires
 * `maxRetriesPerRequest: null` for its blocking operations (it warns and
 * force-overrides this value otherwise), which conflicts with
 * RedisService's own `maxRetriesPerRequest: 3` (correct for that service's
 * own use, wrong for BullMQ's).
 */
@Injectable()
export class BullRedisConnectionService
  extends Redis
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BullRedisConnectionService.name);

  constructor(config: AppConfigService) {
    super(config.redisUrl, { maxRetriesPerRequest: null });
  }

  onModuleInit() {
    this.logger.log('BullMQ Redis connection ready');
  }

  async onModuleDestroy() {
    // quit() (not disconnect()) — waits for BullMQ's own in-flight
    // commands to finish and sends a real QUIT before closing, rather
    // than dropping the socket abruptly mid-command.
    await this.quit();
  }
}
