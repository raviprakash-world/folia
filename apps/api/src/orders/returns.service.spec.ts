// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReturnsService } from './returns.service';
import type { EvidenceFileLike } from './evidence-file.util';

function jpegBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(100),
  ]);
}

function evidenceFile(
  overrides: Partial<EvidenceFileLike> = {},
): EvidenceFileLike {
  const buffer = overrides.buffer ?? jpegBuffer();
  return {
    originalname: 'photo.jpg',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    ...overrides,
  };
}

const NOW = new Date('2026-09-10T12:00:00.000Z');

function hoursAgo(h: number): Date {
  return new Date(NOW.getTime() - h * 60 * 60 * 1000);
}
function daysAgo(d: number): Date {
  return new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);
}

function makePlantItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-plant-1',
    categorySlug: 'plants',
    quantity: 2,
    ...overrides,
  };
}

function makeVesselItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-vessel-1',
    categorySlug: 'vessels',
    quantity: 1,
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    status: 'DELIVERED',
    deliveredAt: hoursAgo(2),
    returnRequest: null,
    items: [makeVesselItem()],
    ...overrides,
  };
}

/** Loosely typed shape of a prisma.returnRequest.create() call's argument — just enough for `.mock.calls` to type-check cleanly in assertions below, not a full Prisma type import. */
interface CreateReturnRequestArgs {
  data: Record<string, unknown>;
}

function createDeps() {
  const prisma = {
    order: { findFirst: jest.fn() },
    returnRequest: {
      create: jest.fn<Promise<unknown>, [CreateReturnRequestArgs]>(),
    },
  };
  const storageService = {
    upload: jest.fn().mockResolvedValue({
      url: '/uploads/return-evidence/fake.jpg',
      key: 'return-evidence/fake.jpg',
    }),
    delete: jest.fn(),
  };

  const service = new ReturnsService(prisma as never, storageService);

  return { prisma, storageService, service };
}

describe('ReturnsService.createClaim', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // --- authorization / ownership ---

  it('throws NotFoundException when the order does not belong to this user (never reveals whether it exists for someone else)', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(null); // findFirst is itself scoped to {id, userId} — this is what a mismatched owner looks like

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it("scopes the lookup to {id: orderId, userId} — a different authenticated user's claim against someone else's order id resolves the same as a nonexistent order", async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.createClaim(
        'attacker-user',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow('Order not found.');
    expect(prisma.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', userId: 'attacker-user' },
      }),
    );
  });

  // --- valid claims ---

  it('creates a valid STANDARD_RETURN for a non-plant order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
      evidence: [],
    });

    const result = await service.createClaim(
      'user-1',
      'order-1',
      {
        items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
        reason: 'wrong-item',
      },
      [],
    );

    expect(result.claimType).toBe('standard-return');
    expect(result.status).toBe('pending');
    const [[createCall]] = prisma.returnRequest.create.mock.calls;
    expect(createCall.data).toEqual(
      expect.objectContaining({
        orderId: 'order-1',
        claimType: 'STANDARD_RETURN',
        reason: 'WRONG_ITEM',
        status: 'PENDING',
      }),
    );
  });

  it('creates a valid DOA_CLAIM for a plant order with evidence', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()], deliveredAt: hoursAgo(1) }),
    );
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
      evidence: [{ url: '/uploads/return-evidence/fake.jpg' }],
    });

    const result = await service.createClaim(
      'user-1',
      'order-1',
      { items: [{ orderItemId: 'item-plant-1', quantity: 1 }], reason: 'doa' },
      [evidenceFile()],
    );

    expect(result.claimType).toBe('doa-claim');
    expect(result.evidence).toEqual([
      { url: '/uploads/return-evidence/fake.jpg' },
    ]);
    const [[createCall]] = prisma.returnRequest.create.mock.calls;
    expect(createCall.data).toEqual(
      expect.objectContaining({ claimType: 'DOA_CLAIM', reason: 'DOA' }),
    );
  });

  it('handles multiple eligible line items in one claim', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({
        items: [
          makeVesselItem({ id: 'item-a', quantity: 2 }),
          makeVesselItem({ id: 'item-b', quantity: 3 }),
        ],
      }),
    );
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [
        { orderItemId: 'item-a', quantity: 1 },
        { orderItemId: 'item-b', quantity: 2 },
      ],
      evidence: [],
    });

    await service.createClaim(
      'user-1',
      'order-1',
      {
        items: [
          { orderItemId: 'item-a', quantity: 1 },
          { orderItemId: 'item-b', quantity: 2 },
        ],
        reason: 'no-longer-needed',
      },
      [],
    );

    const [[createCall]] = prisma.returnRequest.create.mock.calls;
    expect(createCall.data.items).toEqual({
      create: [
        { orderItemId: 'item-a', quantity: 1 },
        { orderItemId: 'item-b', quantity: 2 },
      ],
    });
  });

  it('accepts a partial quantity claim — less than the full purchased quantity on a line', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makeVesselItem({ quantity: 5 })] }),
    );
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-vessel-1', quantity: 2 }],
      evidence: [],
    });

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 2 }],
          reason: 'other',
        },
        [],
      ),
    ).resolves.toBeDefined();
  });

  // --- claim type / mixed-cart / reason validation ---

  it('rejects a claim mixing plant and non-plant items', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem(), makeVesselItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [
            { orderItemId: 'item-plant-1', quantity: 1 },
            { orderItemId: 'item-vessel-1', quantity: 1 },
          ],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(/cannot mix plant and non-plant/);
  });

  it('rejects CHANGED_MIND for a plant claim — live plants are never change-of-mind eligible', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'changed-mind',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow(/not valid for a plant/);
  });

  it('rejects an invalid reason for a DOA claim (e.g. NOT_AS_DESCRIBED, which only applies to standard returns)', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'not-as-described',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow(/not valid for a plant/);
  });

  // --- window enforcement ---

  it('rejects a STANDARD_RETURN once the 14-day window has passed', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ deliveredAt: daysAgo(15) }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'other',
        },
        [],
      ),
    ).rejects.toThrow(/14-day return window/);
  });

  it('rejects a DOA_CLAIM once the 24-hour window has passed', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()], deliveredAt: hoursAgo(25) }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow(/within 24 hours/);
  });

  it('rejects any claim when the order has never been delivered (deliveredAt is null)', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ status: 'SHIPPED', deliveredAt: null }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'other',
        },
        [],
      ),
    ).rejects.toThrow(/not eligible for a return/);
  });

  // --- evidence ---

  it('rejects a DOA_CLAIM with no evidence at all', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [],
      ),
    ).rejects.toThrow(/evidence is required/);
  });

  it('rejects a malformed/unsupported evidence file before ever uploading anything', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [
          evidenceFile({
            mimetype: 'application/pdf',
            originalname: 'evidence.pdf',
          }),
        ],
      ),
    ).rejects.toThrow(BadRequestException);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it('rejects an oversized evidence file before uploading anything', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [evidenceFile({ size: 999_999_999 })],
      ),
    ).rejects.toThrow(/too large/);
    expect(storageService.upload).not.toHaveBeenCalled();
  });

  it('propagates a storage failure cleanly rather than creating a claim record with missing evidence', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    storageService.upload.mockRejectedValue(new Error('disk full'));

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow('disk full');
    expect(prisma.returnRequest.create).not.toHaveBeenCalled();
  });

  // --- orphaned-evidence cleanup ---

  it('cleans up an already-uploaded file when a LATER file in the same request fails to upload', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    storageService.upload
      .mockResolvedValueOnce({
        url: '/uploads/return-evidence/first.jpg',
        key: 'return-evidence/first.jpg',
      })
      .mockRejectedValueOnce(new Error('disk full'));

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [
          evidenceFile({ originalname: 'a.jpg' }),
          evidenceFile({ originalname: 'b.jpg' }),
        ],
      ),
    ).rejects.toThrow('disk full');

    // Only the file that actually made it to storage before the failure
    // is cleaned up — there is nothing to clean up for the file whose
    // own upload call rejected.
    expect(storageService.delete).toHaveBeenCalledTimes(1);
    expect(storageService.delete).toHaveBeenCalledWith(
      'return-evidence/first.jpg',
    );
    expect(prisma.returnRequest.create).not.toHaveBeenCalled();
  });

  it("cleans up this request's uploaded evidence when it loses the ReturnRequest unique-constraint race", async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    storageService.upload.mockResolvedValue({
      url: '/uploads/return-evidence/loser.jpg',
      key: 'return-evidence/loser.jpg',
    });
    prisma.returnRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow('A return or DOA claim already exists for this order.');

    expect(storageService.delete).toHaveBeenCalledWith(
      'return-evidence/loser.jpg',
    );
  });

  it('never deletes evidence belonging to a successful claim — cleanup only runs on the failure path', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
      evidence: [{ url: '/uploads/return-evidence/fake.jpg' }],
    });

    await service.createClaim(
      'user-1',
      'order-1',
      { items: [{ orderItemId: 'item-plant-1', quantity: 1 }], reason: 'doa' },
      [evidenceFile()],
    );

    expect(storageService.delete).not.toHaveBeenCalled();
  });

  it('a cleanup failure itself is swallowed — the caller still sees the original clean rejection, never the cleanup error and never a 500', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    storageService.upload.mockResolvedValue({
      url: '/uploads/return-evidence/loser.jpg',
      key: 'return-evidence/loser.jpg',
    });
    storageService.delete.mockRejectedValue(
      new Error('storage backend unreachable'),
    );
    prisma.returnRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
          reason: 'doa',
        },
        [evidenceFile()],
      ),
    ).rejects.toThrow('A return or DOA claim already exists for this order.');
  });

  it('persists evidence exclusively through the real StorageService upload result — never a client-supplied URL (the DTO has no such field at all)', async () => {
    const { prisma, storageService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makePlantItem()] }),
    );
    storageService.upload.mockResolvedValue({
      url: '/uploads/return-evidence/real-stored-file.jpg',
      key: 'return-evidence/real-stored-file.jpg',
    });
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-plant-1', quantity: 1 }],
      evidence: [{ url: '/uploads/return-evidence/real-stored-file.jpg' }],
    });

    const result = await service.createClaim(
      'user-1',
      'order-1',
      { items: [{ orderItemId: 'item-plant-1', quantity: 1 }], reason: 'doa' },
      [evidenceFile()],
    );

    expect(storageService.upload).toHaveBeenCalledWith(
      expect.objectContaining({ directory: 'return-evidence' }),
    );
    const [[createCall]] = prisma.returnRequest.create.mock.calls;
    expect(createCall.data.evidence).toEqual({
      create: [{ url: '/uploads/return-evidence/real-stored-file.jpg' }],
    });
    expect(result.evidence).toEqual([
      { url: '/uploads/return-evidence/real-stored-file.jpg' },
    ]);
  });

  // --- item/quantity validation ---

  it('rejects an orderItemId that does not exist on this order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(makeOrder());

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'not-a-real-item', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(/does not belong to this order/);
  });

  it("rejects an orderItemId that belongs to a different order — never resolvable since order.items is scoped to this caller's own order", async () => {
    const { prisma, service } = createDeps();
    // The order lookup itself only ever returns THIS order's items — an
    // item id from a different order simply never appears in the map,
    // producing the exact same "does not belong to this order" rejection
    // as a fabricated id. There is no separate code path to bypass.
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makeVesselItem()] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [
            { orderItemId: 'item-from-a-totally-different-order', quantity: 1 },
          ],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(/does not belong to this order/);
  });

  it('rejects a quantity greater than what was purchased on that line', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makeVesselItem({ quantity: 2 })] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 3 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(/only 2 were purchased/);
  });

  it('rejects a quantity of zero or less', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(makeOrder());

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 0 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow('Quantity must be greater than zero.');
  });

  it('rejects the same order item listed twice within one claim submission', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ items: [makeVesselItem({ quantity: 5 })] }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [
            { orderItemId: 'item-vessel-1', quantity: 1 },
            { orderItemId: 'item-vessel-1', quantity: 1 },
          ],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow(/listed more than once/);
  });

  // --- already-claimed / concurrency / idempotency ---

  it('rejects outright when the order already has a return/DOA claim (the fast, friendly pre-check)', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrder({ returnRequest: { id: 'existing-rr' } }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow('A return or DOA claim already exists for this order.');
  });

  it('converts a concurrent duplicate-claim race (P2002 on the orderId unique constraint) into a clean BadRequestException, never a raw database error', async () => {
    const { prisma, service } = createDeps();
    // The pre-check above sees no existing claim (both requests read
    // before either commits) — the real, race-proof guarantee is the
    // unique constraint itself, exercised here via a mocked P2002 from
    // the actual create() call, exactly mirroring how
    // OrdersService.requestCancellation's own equivalent race is tested.
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.returnRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow('A return or DOA claim already exists for this order.');
  });

  it('rejects a sequential duplicate submission the same way a concurrent one is rejected — once a claim exists, a second attempt (however it arrives) is refused', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst
      .mockResolvedValueOnce(makeOrder())
      .mockResolvedValueOnce(makeOrder({ returnRequest: { id: 'rr-1' } }));
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
      evidence: [],
    });

    const first = await service.createClaim(
      'user-1',
      'order-1',
      {
        items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
        reason: 'wrong-item',
      },
      [],
    );
    expect(first.id).toBe('rr-1');

    await expect(
      service.createClaim(
        'user-1',
        'order-1',
        {
          items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
          reason: 'wrong-item',
        },
        [],
      ),
    ).rejects.toThrow('A return or DOA claim already exists for this order.');
  });

  it('does not touch Order.status and does not initiate a refund/store-credit/replacement — a new claim only ever writes the ReturnRequest/ReturnRequestItem/ReturnEvidence rows, and starts PENDING', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(makeOrder());
    prisma.returnRequest.create.mockResolvedValue({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'PENDING',
      note: null,
      requestedAt: NOW,
      items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
      evidence: [],
    });

    // The mock's `order` object deliberately has no `update` method at
    // all — if createClaim ever tried to mutate Order.status, this call
    // would throw "this.prisma.order.update is not a function" instead of
    // resolving, which is exactly the failure mode this test relies on.
    const result = await service.createClaim(
      'user-1',
      'order-1',
      {
        items: [{ orderItemId: 'item-vessel-1', quantity: 1 }],
        reason: 'wrong-item',
      },
      [],
    );

    expect(result.status).toBe('pending');
  });
});
