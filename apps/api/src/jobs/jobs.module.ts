import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReleaseExpiredReservationsProcessor } from './release-expired-reservations.processor';
import { ExpireStalePaymentsProcessor } from './expire-stale-payments.processor';
import { BullRedisConnectionModule } from './bull-redis-connection.module';
import { BullRedisConnectionService } from './bull-redis-connection.service';
import {
  RELEASE_EXPIRED_RESERVATIONS_QUEUE,
  EXPIRE_STALE_PAYMENTS_QUEUE,
} from './jobs.constants';

export { RELEASE_EXPIRED_RESERVATIONS_QUEUE, EXPIRE_STALE_PAYMENTS_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [BullRedisConnectionModule],
      inject: [BullRedisConnectionService],
      // P0-D — connection is now a real injectable provider with its own
      // OnModuleDestroy (bull-redis-connection.service.ts), closing the
      // graceful-shutdown gap that let this Redis connection outlive
      // app.close(). Previously a bare `new Redis(...)` created inline
      // right here, with no reference kept anywhere to ever close it.
      useFactory: (connection: BullRedisConnectionService) => ({
        connection,
      }),
    }),
    BullModule.registerQueue({ name: RELEASE_EXPIRED_RESERVATIONS_QUEUE }),
    BullModule.registerQueue({ name: EXPIRE_STALE_PAYMENTS_QUEUE }),
    InventoryModule,
    PaymentsModule,
  ],
  providers: [
    ReleaseExpiredReservationsProcessor,
    ExpireStalePaymentsProcessor,
  ],
})
export class JobsModule {}
