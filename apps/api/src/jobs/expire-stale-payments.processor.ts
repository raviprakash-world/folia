import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { OnModuleInit, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PaymentsService } from '../payments/payments.service';
import { EXPIRE_STALE_PAYMENTS_QUEUE } from './jobs.constants';

const RUN_EVERY_MS = 5 * 60 * 1000; // same cadence as release-expired-reservations — frequent enough that an abandoned checkout's stock isn't locked away for long

/**
 * Schedules PaymentsService.expireStalePayments() — see that method's
 * doc comment for why this exists (Phase 1 made payment asynchronous,
 * which means an order can now be left in PENDING_PAYMENT forever if a
 * customer never completes checkout). Thin wrapper, same shape as
 * ReleaseExpiredReservationsProcessor — all the real logic lives in the
 * service, this file is scheduling only.
 */
@Processor(EXPIRE_STALE_PAYMENTS_QUEUE)
export class ExpireStalePaymentsProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(ExpireStalePaymentsProcessor.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    @InjectQueue(EXPIRE_STALE_PAYMENTS_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(EXPIRE_STALE_PAYMENTS_QUEUE, {
      every: RUN_EVERY_MS,
    });
  }

  async process(_job: Job): Promise<{ expiredCount: number }> {
    const expiredCount = await this.paymentsService.expireStalePayments();
    if (expiredCount > 0) {
      this.logger.log(`Expired ${expiredCount} stale pending-payment order(s)`);
    }
    return { expiredCount };
  }
}
