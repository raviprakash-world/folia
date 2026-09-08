import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { BullRedisConnectionService } from './bull-redis-connection.service';

/**
 * Exists only so BullModule.forRootAsync (jobs.module.ts) can `inject`
 * BullRedisConnectionService into its own factory via `imports` — same
 * pattern this codebase already uses for AppConfigModule/AppConfigService
 * there. A provider can't be injected into a dynamic module's
 * forRootAsync from the very module that's registering that dynamic
 * module in the same breath, so this small module exists to break that
 * chicken-and-egg ordering.
 */
@Module({
  imports: [AppConfigModule],
  providers: [BullRedisConnectionService],
  exports: [BullRedisConnectionService],
})
export class BullRedisConnectionModule {}
