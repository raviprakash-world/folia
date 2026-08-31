import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { OnModuleInit, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { InventoryService } from '../inventory/inventory.service';
import { RELEASE_EXPIRED_RESERVATIONS_QUEUE } from './jobs.constants';

const RUN_EVERY_MS = 5 * 60 * 1000; // every 5 minutes — frequent enough that an abandoned cart's reserved stock isn't locked away for long, infrequent enough not to hammer the database on a schedule for what's usually a no-op

/**
 * Wires InventoryService.releaseExpiredReservations() (built and tested
 * since Phase 3, originally with a doc comment saying "meant to be
 * called on a schedule once BullMQ background jobs exist" — that's now
 * true) into a real, scheduled BullMQ job. The job body itself is a thin
 * wrapper — all the actual logic (finding expired reservations,
 * releasing them, restoring their reserved stock) was already built and
 * tested; this phase's job is scheduling and running it for real, not
 * reimplementing it.
 */
@Processor(RELEASE_EXPIRED_RESERVATIONS_QUEUE)
export class ReleaseExpiredReservationsProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(
    ReleaseExpiredReservationsProcessor.name,
  );

  constructor(
    private readonly inventoryService: InventoryService,
    @InjectQueue(RELEASE_EXPIRED_RESERVATIONS_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler is idempotent — safe to call on every app boot
    // without creating duplicate schedules, confirmed against BullMQ's
    // own doc comment ("Upserting a scheduler will create a new job
    // scheduler or update an existing one") rather than assumed.
    await this.queue.upsertJobScheduler(RELEASE_EXPIRED_RESERVATIONS_QUEUE, {
      every: RUN_EVERY_MS,
    });
  }

  async process(_job: Job): Promise<{ releasedCount: number }> {
    const releasedCount =
      await this.inventoryService.releaseExpiredReservations();
    if (releasedCount > 0) {
      this.logger.log(`Released ${releasedCount} expired stock reservation(s)`);
    }
    return { releasedCount };
  }
}
