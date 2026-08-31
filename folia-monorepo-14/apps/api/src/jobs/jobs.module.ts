import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';
import { AppConfigModule } from '../config/config.module';
import { AppConfigService } from '../config/app-config.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ReleaseExpiredReservationsProcessor } from './release-expired-reservations.processor';
import { RELEASE_EXPIRED_RESERVATIONS_QUEUE } from './jobs.constants';

export { RELEASE_EXPIRED_RESERVATIONS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      // A separate ioredis instance from RedisService's, deliberately —
      // BullMQ requires maxRetriesPerRequest: null for its blocking
      // operations (confirmed directly against bullmq's own connection
      // handling: it warns and force-overrides this value otherwise),
      // which conflicts with RedisService's own maxRetriesPerRequest: 3
      // (correct for that service's own use, wrong for BullMQ's).
      useFactory: (config: AppConfigService) => ({
        connection: new Redis(config.redisUrl, { maxRetriesPerRequest: null }),
      }),
    }),
    BullModule.registerQueue({ name: RELEASE_EXPIRED_RESERVATIONS_QUEUE }),
    InventoryModule,
  ],
  providers: [ReleaseExpiredReservationsProcessor],
})
export class JobsModule {}
