import { ReleaseExpiredReservationsProcessor } from './release-expired-reservations.processor';
import { RELEASE_EXPIRED_RESERVATIONS_QUEUE } from './jobs.constants';

function createDeps() {
  const inventoryService = { releaseExpiredReservations: jest.fn() };
  const queue = { upsertJobScheduler: jest.fn() };
  const processor = new ReleaseExpiredReservationsProcessor(
    inventoryService as never,
    queue as never,
  );
  return { inventoryService, queue, processor };
}

describe('ReleaseExpiredReservationsProcessor.onModuleInit', () => {
  it("registers a real repeating schedule under the queue's own name, every 5 minutes", async () => {
    const { queue, processor } = createDeps();
    await processor.onModuleInit();
    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      RELEASE_EXPIRED_RESERVATIONS_QUEUE,
      { every: 5 * 60 * 1000 },
    );
  });
});

describe('ReleaseExpiredReservationsProcessor.process', () => {
  it('delegates to the real, already-tested InventoryService.releaseExpiredReservations — no logic duplicated here', async () => {
    const { inventoryService, processor } = createDeps();
    inventoryService.releaseExpiredReservations.mockResolvedValue(3);

    const result = await processor.process({} as never);

    expect(inventoryService.releaseExpiredReservations).toHaveBeenCalledTimes(
      1,
    );
    expect(result).toEqual({ releasedCount: 3 });
  });

  it('returns a real zero count without error when there was nothing to release', async () => {
    const { inventoryService, processor } = createDeps();
    inventoryService.releaseExpiredReservations.mockResolvedValue(0);

    const result = await processor.process({} as never);

    expect(result).toEqual({ releasedCount: 0 });
  });
});
