// Same reasoning as auth.service.spec.ts's top-of-file comment.
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReturnsService } from './returns.service';
import type { EvidenceFileLike } from './evidence-file.util';
import type { LogAuditInput } from '../audit/audit.types';

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

/** Loosely typed shape of a prisma.returnRequest.updateMany() call's argument — just enough for assertions below to type-check cleanly. */
interface UpdateManyReturnRequestArgs {
  where: Record<string, unknown>;
  data: Record<string, unknown>;
}

function createDeps() {
  const prisma = {
    order: { findFirst: jest.fn() },
    returnRequest: {
      create: jest.fn<Promise<unknown>, [CreateReturnRequestArgs]>(),
      updateMany: jest.fn<
        Promise<{ count: number }>,
        [UpdateManyReturnRequestArgs]
      >(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
  const storageService = {
    upload: jest.fn().mockResolvedValue({
      url: '/uploads/return-evidence/fake.jpg',
      key: 'return-evidence/fake.jpg',
    }),
    delete: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };
  const auditService = {
    log: jest.fn<Promise<void>, [LogAuditInput]>().mockResolvedValue(undefined),
  };

  const service = new ReturnsService(
    prisma as never,
    storageService,
    eventEmitter,
    auditService as never,
  );

  return { prisma, storageService, eventEmitter, auditService, service };
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

// --- Phase 6D-4A: admin queue, detail, approve/reject ---

function makeAdminRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rr-1',
    orderId: 'order-1',
    claimType: 'STANDARD_RETURN',
    reason: 'WRONG_ITEM',
    note: 'Arrived with a chip',
    requestedAt: new Date('2026-09-10T10:00:00.000Z'),
    status: 'PENDING',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    resolutionType: null,
    requiresReverseLogistics: null,
    refundAmount: null,
    refundId: null,
    replacementOrderId: null,
    storeCreditEntry: null,
    items: [
      {
        orderItemId: 'item-1',
        quantity: 1,
        orderItem: { name: 'Ceramic Vessel — Ash', price: 42, quantity: 2 },
      },
    ],
    evidence: [],
    order: {
      id: 'order-1',
      total: 47.54,
      deliveredAt: new Date('2026-09-09T10:00:00.000Z'),
      user: {
        id: 'user-1',
        firstName: 'Sam',
        lastName: 'Rivera',
        email: 'sam@example.com',
      },
    },
    ...overrides,
  };
}

describe('ReturnsService.adminListClaims', () => {
  it('defaults to the PENDING queue, ordered oldest-first, and maps every required field', async () => {
    const { prisma, service } = createDeps();
    const row = makeAdminRow();
    prisma.returnRequest.findMany.mockResolvedValue([row]);
    prisma.returnRequest.count.mockResolvedValue(1);

    const result = await service.adminListClaims({
      status: 'pending',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING' },
        orderBy: { requestedAt: 'asc' },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.total).toBe(1);
    const [item] = result.items as Array<Record<string, unknown>>;
    expect(item).toMatchObject({
      id: 'rr-1',
      orderId: 'order-1',
      status: 'pending',
      claimType: 'standard-return',
      reason: 'wrong-item',
      note: 'Arrived with a chip',
    });
    expect(item.customer).toEqual({
      id: 'user-1',
      firstName: 'Sam',
      lastName: 'Rivera',
      email: 'sam@example.com',
    });
    expect(item.items).toEqual([
      {
        orderItemId: 'item-1',
        quantity: 1,
        productName: 'Ceramic Vessel — Ash',
        unitPrice: 42,
        purchasedQuantity: 2,
        claimedLineValue: 42,
      },
    ]);
    expect(item.policy).toEqual({
      evidenceRequired: false,
      evidenceProvided: false,
      reasonEligible: true,
    });
    expect(item.resolution).toEqual({
      resolutionType: null,
      requiresReverseLogistics: null,
      refundAmount: null,
      refundId: null,
      replacementOrderId: null,
      storeCreditEntryId: null,
    });
  });

  it('paginates using page/pageSize, clamped at 50', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findMany.mockResolvedValue([]);
    prisma.returnRequest.count.mockResolvedValue(0);

    await service.adminListClaims({
      status: 'pending',
      page: 3,
      pageSize: 999,
    });

    expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });

  it('filters by a different status when asked (e.g. reviewing already-approved claims)', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findMany.mockResolvedValue([]);
    prisma.returnRequest.count.mockResolvedValue(0);

    await service.adminListClaims({
      status: 'approved',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'APPROVED' } }),
    );
  });

  it('marks a DOA claim as evidence-required and reflects whether evidence was actually provided', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findMany.mockResolvedValue([
      makeAdminRow({
        claimType: 'DOA_CLAIM',
        reason: 'DOA',
        evidence: [
          { url: '/uploads/return-evidence/a.jpg', createdAt: new Date() },
        ],
      }),
    ]);
    prisma.returnRequest.count.mockResolvedValue(1);

    const result = await service.adminListClaims({
      status: 'pending',
      page: 1,
      pageSize: 20,
    });

    const [item] = result.items as Array<Record<string, unknown>>;
    expect(item.policy).toMatchObject({
      evidenceRequired: true,
      evidenceProvided: true,
      reasonEligible: true,
    });
  });
});

describe('ReturnsService.adminGetClaim', () => {
  it('returns the full mapped detail for an existing claim', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(makeAdminRow());

    const result = await service.adminGetClaim('rr-1');

    expect(result.id).toBe('rr-1');
    expect(result.order).toEqual({
      id: 'order-1',
      total: 47.54,
      deliveredAt: '2026-09-09T10:00:00.000Z',
    });
  });

  it('throws NotFoundException for a nonexistent return request', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(null);

    await expect(service.adminGetClaim('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('ReturnsService.adminApprove', () => {
  it('transitions PENDING -> APPROVED, records who/when, and returns the updated claim', async () => {
    const { prisma, service, auditService, eventEmitter } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({
        status: 'APPROVED',
        decidedBy: 'admin-1',
        decidedAt: new Date('2026-09-10T12:00:00.000Z'),
        decisionNote: 'Looks legitimate',
      }),
    );

    const result = await service.adminApprove(
      'admin-1',
      'rr-1',
      { note: 'Looks legitimate' },
      '10.0.0.1',
    );

    const [[updateCall]] = prisma.returnRequest.updateMany.mock.calls;
    expect(updateCall.where).toEqual({ id: 'rr-1', status: 'PENDING' });
    expect(updateCall.data).toMatchObject({
      status: 'APPROVED',
      decidedBy: 'admin-1',
      decisionNote: 'Looks legitimate',
    });
    expect(result.status).toBe('approved');

    expect(auditService.log).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'RETURN_APPROVED',
      resource: 'return_request',
      resourceId: 'rr-1',
      metadata: { orderId: 'order-1', note: 'Looks legitimate' },
      ipAddress: '10.0.0.1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.return_approved',
      {
        returnRequestId: 'rr-1',
        orderId: 'order-1',
        userId: 'user-1',
      },
    );
  });

  it('rejects approving an already-APPROVED claim with a clean ConflictException', async () => {
    const { prisma, service, auditService, eventEmitter } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(
      service.adminApprove('admin-1', 'rr-1', {}, undefined),
    ).rejects.toThrow(ConflictException);
    expect(auditService.log).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects approving an already-REJECTED claim with a clean ConflictException, naming the actual current state', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'REJECTED' });

    await expect(
      service.adminApprove('admin-1', 'rr-1', {}, undefined),
    ).rejects.toThrow(/already rejected/);
  });

  it('throws NotFoundException when approving a return request that does not exist at all', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.adminApprove('admin-1', 'unknown', {}, undefined),
    ).rejects.toThrow(NotFoundException);
  });

  it('never creates a refund/store-credit/replacement side effect — approval only records the decision', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED' }),
    );

    await service.adminApprove('admin-1', 'rr-1', {}, undefined);

    // The mock prisma object has no payment/refund/storeCreditEntry/order.update
    // methods at all — if adminApprove tried to call any of them, this test
    // would fail with a "not a function" error rather than passing silently.
    expect(Object.keys(prisma)).toEqual(['order', 'returnRequest']);
  });

  it('exactly one of two concurrent approve calls for the same claim succeeds', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED' }),
    );
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'APPROVED' });

    const [first, second] = await Promise.allSettled([
      service.adminApprove('admin-1', 'rr-1', {}, undefined),
      service.adminApprove('admin-2', 'rr-1', {}, undefined),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
    const rejected = [first, second].find(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    )!;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
  });
});

describe('ReturnsService.adminReject', () => {
  it('transitions PENDING -> REJECTED, storing the required reason as decisionNote', async () => {
    const { prisma, service, auditService, eventEmitter } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({
        status: 'REJECTED',
        decidedBy: 'admin-1',
        decisionNote: 'Outside the return window',
      }),
    );

    const result = await service.adminReject(
      'admin-1',
      'rr-1',
      { reason: 'Outside the return window' },
      '10.0.0.1',
    );

    const [[updateCall]] = prisma.returnRequest.updateMany.mock.calls;
    expect(updateCall.where).toEqual({ id: 'rr-1', status: 'PENDING' });
    expect(updateCall.data).toMatchObject({
      status: 'REJECTED',
      decisionNote: 'Outside the return window',
    });
    expect(result.status).toBe('rejected');
    expect(auditService.log).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'RETURN_REJECTED',
      resource: 'return_request',
      resourceId: 'rr-1',
      metadata: { orderId: 'order-1', reason: 'Outside the return window' },
      ipAddress: '10.0.0.1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.return_rejected',
      {
        returnRequestId: 'rr-1',
        orderId: 'order-1',
        userId: 'user-1',
        reason: 'Outside the return window',
      },
    );
  });

  it('rejects rejecting an already-REJECTED claim with a clean ConflictException', async () => {
    const { prisma, service, auditService } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'REJECTED' });

    await expect(
      service.adminReject('admin-1', 'rr-1', { reason: 'x' }, undefined),
    ).rejects.toThrow(ConflictException);
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('rejects rejecting an already-APPROVED claim with a clean ConflictException', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(
      service.adminReject('admin-1', 'rr-1', { reason: 'x' }, undefined),
    ).rejects.toThrow(/already approved/);
  });

  it('never creates a refund/store-credit/replacement side effect — rejection only records the decision', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'REJECTED' }),
    );

    await service.adminReject('admin-1', 'rr-1', { reason: 'x' }, undefined);

    expect(Object.keys(prisma)).toEqual(['order', 'returnRequest']);
  });

  it('exactly one of two concurrent reject calls for the same claim succeeds', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'REJECTED' }),
    );
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'REJECTED' });

    const [first, second] = await Promise.allSettled([
      service.adminReject('admin-1', 'rr-1', { reason: 'a' }, undefined),
      service.adminReject('admin-2', 'rr-1', { reason: 'b' }, undefined),
    ]);

    const outcomes = [first.status, second.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
  });
});

describe('ReturnsService approve vs reject cross-race', () => {
  it('a concurrent APPROVE and REJECT for the same claim produce exactly one winner', async () => {
    const { prisma, service } = createDeps();
    // Whichever call's UPDATE statement reaches Postgres first wins in
    // reality; both orderings are equally valid, so this simulates one
    // arbitrary but internally consistent outcome (approve wins).
    prisma.returnRequest.updateMany
      .mockResolvedValueOnce({ count: 1 }) // approve's own conditional update
      .mockResolvedValueOnce({ count: 0 }); // reject's own conditional update, now stale
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED' }),
    );
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'APPROVED' });

    const [approveResult, rejectResult] = await Promise.allSettled([
      service.adminApprove('admin-1', 'rr-1', {}, undefined),
      service.adminReject('admin-2', 'rr-1', { reason: 'too late' }, undefined),
    ]);

    expect(approveResult.status).toBe('fulfilled');
    expect(rejectResult.status).toBe('rejected');
    if (rejectResult.status === 'rejected') {
      expect(rejectResult.reason).toBeInstanceOf(ConflictException);
    }
  });
});

describe('ReturnsService admin audit — no false successes', () => {
  it('a stale/conflicting approve attempt never calls AuditService.log at all', async () => {
    const { prisma, service, auditService } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.returnRequest.findUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(
      service.adminApprove('admin-1', 'rr-1', {}, undefined),
    ).rejects.toThrow(ConflictException);

    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('a successful approval logs exactly one RETURN_APPROVED audit record', async () => {
    const { prisma, service, auditService } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED' }),
    );

    await service.adminApprove('admin-1', 'rr-1', {}, undefined);

    expect(auditService.log).toHaveBeenCalledTimes(1);
    const [[loggedInput]] = auditService.log.mock.calls;
    expect(loggedInput.action).toBe('RETURN_APPROVED');
  });

  it('a successful rejection logs exactly one RETURN_REJECTED audit record', async () => {
    const { prisma, service, auditService } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'REJECTED' }),
    );

    await service.adminReject('admin-1', 'rr-1', { reason: 'x' }, undefined);

    expect(auditService.log).toHaveBeenCalledTimes(1);
    const [[loggedInput]] = auditService.log.mock.calls;
    expect(loggedInput.action).toBe('RETURN_REJECTED');
  });
});
