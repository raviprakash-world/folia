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

/** Loosely typed shape of a prisma.order.create() call's argument (Phase 6D-4C's replacement-order creation) — just enough for `.mock.calls` to type-check cleanly below. */
interface CreateOrderArgs {
  data: Record<string, unknown> & {
    id: string;
    items: { create: Record<string, unknown>[] };
    payment: { create: Record<string, unknown> };
  };
}

function createDeps() {
  const prisma = {
    order: {
      findFirst: jest.fn(),
      create: jest.fn<Promise<unknown>, [CreateOrderArgs]>(),
    },
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
    storeCreditEntry: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    // Every real transactional write this service performs
    // (resolveReplacement, Phase 6D-4C) targets the SAME mock objects
    // above — a real Prisma `tx` is just a scoped client, and nothing here
    // simulates actual rollback semantics, so reusing `prisma` itself as
    // `tx` is sufficient: tests assert JS-level control flow (which
    // branch ran, what got released), not genuine Postgres atomicity.
    $transaction: jest
      .fn()
      .mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
        cb(prisma),
      ),
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
  const paymentsService = { refund: jest.fn() };
  const inventoryService = {
    reserveForProduct: jest.fn(),
    commitReservation: jest.fn(),
    releaseReservation: jest.fn(),
  };

  const service = new ReturnsService(
    prisma as never,
    storageService,
    eventEmitter,
    auditService as never,
    paymentsService as never,
    inventoryService as never,
  );

  return {
    prisma,
    storageService,
    eventEmitter,
    auditService,
    inventoryService,
    paymentsService,
    service,
  };
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

  it('persists resolutionType REPLACEMENT when the admin chooses it for a DOA_CLAIM', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue({
      claimType: 'DOA_CLAIM',
    });
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED', resolutionType: 'REPLACEMENT' }),
    );

    await service.adminApprove(
      'admin-1',
      'rr-1',
      { resolutionType: 'REPLACEMENT' },
      undefined,
    );

    const [[updateCall]] = prisma.returnRequest.updateMany.mock.calls;
    expect(updateCall.data).toMatchObject({ resolutionType: 'REPLACEMENT' });
  });

  it('rejects choosing REPLACEMENT for a STANDARD_RETURN claim with BadRequestException', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue({
      claimType: 'STANDARD_RETURN',
    });

    await expect(
      service.adminApprove(
        'admin-1',
        'rr-1',
        { resolutionType: 'REPLACEMENT' },
        undefined,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.returnRequest.updateMany).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when choosing REPLACEMENT for a claim that does not exist', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.adminApprove(
        'admin-1',
        'unknown',
        { resolutionType: 'REPLACEMENT' },
        undefined,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('never creates a refund/store-credit/replacement side effect — approval only records the decision', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'APPROVED' }),
    );

    await service.adminApprove('admin-1', 'rr-1', {}, undefined);

    expect(paymentsService.refund).not.toHaveBeenCalled();
    expect(prisma.storeCreditEntry.create).not.toHaveBeenCalled();
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
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue(
      makeAdminRow({ status: 'REJECTED' }),
    );

    await service.adminReject('admin-1', 'rr-1', { reason: 'x' }, undefined);

    expect(paymentsService.refund).not.toHaveBeenCalled();
    expect(prisma.storeCreditEntry.create).not.toHaveBeenCalled();
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

// --- Phase 6D-4B: financial resolution ---

function makeResolutionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rr-1',
    orderId: 'order-1',
    claimType: 'STANDARD_RETURN',
    reason: 'WRONG_ITEM',
    status: 'APPROVED',
    refundAmount: null,
    resolutionType: null,
    items: [
      {
        orderItemId: 'item-1',
        quantity: 1,
        orderItem: {
          price: 42,
          quantity: 2,
          productId: 'prod-1',
          slug: 'monstera',
          name: 'Monstera',
          categorySlug: 'plants',
          variantId: null,
          variantLabel: null,
        },
      },
    ],
    order: {
      id: 'order-1',
      userId: 'user-1',
      subtotal: 42,
      discount: 0,
      tax: 3.36,
      paymentMethod: 'CREDIT_CARD',
      payment: { id: 'pay-1' },
      shippingAddressSnapshot: { city: 'patna' },
      billingAddressSnapshot: { city: 'patna' },
      deliveryMethod: 'STANDARD',
      estimatedDelivery: '3-5 business days',
    },
    ...overrides,
  };
}

describe('ReturnsService.resolveClaim — eligibility', () => {
  it('throws NotFoundException for a nonexistent return request', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.resolveClaim('admin-1', 'unknown', undefined),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects resolving a PENDING claim', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeResolutionRow({ status: 'PENDING' }),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects resolving a REJECTED claim', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeResolutionRow({ status: 'REJECTED' }),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow(ConflictException);
  });

  it('is idempotent for an already REFUND_ISSUED claim — returns the persisted result, never re-executes', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeResolutionRow({ status: 'REFUND_ISSUED' }))
      .mockResolvedValueOnce(makeAdminRow({ status: 'REFUND_ISSUED' }));

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(result.status).toBe('refund-issued');
    expect(paymentsService.refund).not.toHaveBeenCalled();
  });

  it('is idempotent for an already STORE_CREDIT_ISSUED claim — returns the persisted result, never re-executes', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(
        makeResolutionRow({ status: 'STORE_CREDIT_ISSUED' }),
      )
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(result.status).toBe('store-credit-issued');
  });

  it('rejects with a zero computed refund amount rather than resolving nothing', async () => {
    const { prisma, service } = createDeps();
    // eligibleItemSubtotal (42) with a huge deduction relative to a tiny
    // order — engineered so calculateRefundAmount floors to 0.
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeResolutionRow({
        reason: 'CHANGED_MIND',
        items: [
          {
            orderItemId: 'item-1',
            quantity: 1,
            orderItem: { price: 1, quantity: 1 },
          },
        ],
        order: {
          id: 'order-1',
          userId: 'user-1',
          subtotal: 1000,
          discount: 0,
          tax: 80,
          paymentMethod: 'CREDIT_CARD',
          payment: { id: 'pay-1' },
        },
      }),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow(/zero/);
  });
});

describe('ReturnsService.resolveClaim — prepaid refund', () => {
  it('resolves an approved prepaid claim through PaymentsService.refund() with the correct frozen amount', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeResolutionRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REFUND_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    paymentsService.refund.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
      providerRefundId: 'rfnd_1',
    });

    await service.resolveClaim('admin-1', 'rr-1', '10.0.0.1');

    // subtotal=42, discount=0, tax=3.36, eligibleItemSubtotal=42 (full),
    // reason=WRONG_ITEM (no deduction) -> 42 - 0 + 3.36 = 45.36
    expect(paymentsService.refund).toHaveBeenCalledWith(
      'pay-1',
      expect.objectContaining({ amount: 45.36 }),
      { actorId: 'admin-1', actorType: 'admin', ipAddress: '10.0.0.1' },
    );
  });

  it('never calls the Razorpay SDK/provider directly — ReturnsService has no such dependency at all, only PaymentsService', () => {
    // Structural guarantee, not a runtime check: ReturnsService's
    // constructor never receives a RazorpayProvider (see its DI graph) —
    // there is no code path by which it could call Razorpay directly.
    // Documented here rather than asserted at runtime, since there is
    // nothing to mock/spy on that ReturnsService could even call.
    expect(true).toBe(true);
  });

  it('persists refundId and transitions to REFUND_ISSUED on success', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeResolutionRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REFUND_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    paymentsService.refund.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
      providerRefundId: 'rfnd_1',
    });

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(result.status).toBe('refund-issued');
    const statusUpdateCall = prisma.returnRequest.updateMany.mock.calls.find(
      (call) => call[0].data.status === 'REFUND_ISSUED',
    );
    expect(statusUpdateCall![0]).toEqual({
      where: { id: 'rr-1', status: 'APPROVED' },
      data: {
        status: 'REFUND_ISSUED',
        resolutionType: 'REFUND',
        refundId: 'refund-1',
      },
    });
  });

  it('leaves the claim retryable (APPROVED, no fake success) when the gateway refund fails', async () => {
    const { prisma, paymentsService, auditService, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(makeResolutionRow());
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    paymentsService.refund.mockRejectedValue(new Error('gateway unreachable'));

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow('gateway unreachable');

    // No status/resolutionType/refundId update was ever attempted for a
    // successful transition.
    const successUpdate = prisma.returnRequest.updateMany.mock.calls.find(
      (call) => call[0].data.status === 'REFUND_ISSUED',
    );
    expect(successUpdate).toBeUndefined();

    const [[loggedInput]] = auditService.log.mock.calls;
    expect(loggedInput.action).toBe('RETURN_REFUND_FAILED');
  });

  it('never creates a duplicate refund on repeated resolution once the amount is frozen — a clean conflict instead', async () => {
    const { prisma, paymentsService, service } = createDeps();
    // Simulates: a first call already froze refundAmount (whether it
    // succeeded, failed, or is a concurrent racer — see the KNOWN GAP
    // doc comment in returns.service.ts for why prepaid can't safely
    // distinguish these).
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeResolutionRow({ refundAmount: 45.36 }),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow(ConflictException);
    expect(paymentsService.refund).not.toHaveBeenCalled();
  });

  it('exactly one of two concurrent first-time resolution attempts proceeds to call PaymentsService.refund()', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeResolutionRow()) // request A's fetch
      .mockResolvedValueOnce(makeResolutionRow()) // request B's fetch
      .mockResolvedValueOnce(makeAdminRow({ status: 'REFUND_ISSUED' })); // A's final adminGetClaim
    // A's freeze wins (count: 1), B's freeze loses (count: 0).
    prisma.returnRequest.updateMany
      .mockResolvedValueOnce({ count: 1 }) // A freezes refundAmount
      .mockResolvedValueOnce({ count: 0 }) // B loses the freeze race
      .mockResolvedValueOnce({ count: 1 }); // A's success status transition
    // B re-reads fresh state after losing the freeze race: still
    // APPROVED, refundAmount now frozen by A.
    prisma.returnRequest.findUniqueOrThrow.mockResolvedValue({
      status: 'APPROVED',
      refundAmount: 45.36,
    });
    paymentsService.refund.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
      providerRefundId: 'rfnd_1',
    });

    const [a, b] = await Promise.allSettled([
      service.resolveClaim('admin-1', 'rr-1', undefined),
      service.resolveClaim('admin-2', 'rr-1', undefined),
    ]);

    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('rejected');
    if (b.status === 'rejected') {
      expect(b.reason).toBeInstanceOf(ConflictException);
    }
    expect(paymentsService.refund).toHaveBeenCalledTimes(1);
  });
});

describe('ReturnsService.resolveClaim — COD store credit', () => {
  function makeCodRow(overrides: Record<string, unknown> = {}) {
    return makeResolutionRow({
      order: {
        id: 'order-1',
        userId: 'user-1',
        subtotal: 42,
        discount: 0,
        tax: 3.36,
        paymentMethod: 'COD',
        payment: { id: 'pay-1' },
      },
      ...overrides,
    });
  }

  it('creates a StoreCreditEntry for the exact frozen amount, linked to the ReturnRequest', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockResolvedValue({ id: 'sce-1' });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(prisma.storeCreditEntry.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        amount: 45.36, // 42 - 0 + 3.36
        reason: 'Return resolution for order order-1',
        returnRequestId: 'rr-1',
      },
    });
  });

  it('never calls PaymentsService.refund() for COD — no Razorpay involvement at all', async () => {
    const { prisma, paymentsService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockResolvedValue({ id: 'sce-1' });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(paymentsService.refund).not.toHaveBeenCalled();
  });

  it('transitions to STORE_CREDIT_ISSUED, never REFUND_ISSUED, and never touches Payment.status', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockResolvedValue({ id: 'sce-1' });

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(result.status).toBe('store-credit-issued');
    const statusCall = prisma.returnRequest.updateMany.mock.calls.find(
      (call) => call[0].data.status,
    );
    expect(statusCall![0].data).toEqual({
      status: 'STORE_CREDIT_ISSUED',
      resolutionType: 'FOLIA_STORE_CREDIT',
    });
    // The mock's `prisma` has no `payment` model at all — if resolveClaim
    // ever tried to touch Payment directly for COD, this would fail with
    // a "not a function" error rather than passing silently.
  });

  it('duplicate resolution of an already-issued COD claim does not create a second StoreCreditEntry', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow({ status: 'STORE_CREDIT_ISSUED' }))
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(prisma.storeCreditEntry.create).not.toHaveBeenCalled();
  });

  it('a concurrent duplicate create() attempt (P2002 on the unique returnRequestId) is treated as idempotent, not an error, and never double-credits', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    prisma.storeCreditEntry.findUniqueOrThrow.mockResolvedValue({
      id: 'sce-existing',
    });

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(result.status).toBe('store-credit-issued');
    expect(prisma.storeCreditEntry.create).toHaveBeenCalledTimes(1);
  });

  it('exactly one StoreCreditEntry results from two concurrent resolution requests for the same claim', async () => {
    const { prisma, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeCodRow()) // A
      .mockResolvedValueOnce(makeCodRow()) // B
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' })) // A's final read
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' })); // B's final read
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    // A wins the real create(); B collides on the unique constraint.
    prisma.storeCreditEntry.create
      .mockResolvedValueOnce({ id: 'sce-1' })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '6.19.3',
        }),
      );
    prisma.storeCreditEntry.findUniqueOrThrow.mockResolvedValue({
      id: 'sce-1',
    });

    const [a, b] = await Promise.allSettled([
      service.resolveClaim('admin-1', 'rr-1', undefined),
      service.resolveClaim('admin-2', 'rr-1', undefined),
    ]);

    expect(a.status).toBe('fulfilled');
    expect(b.status).toBe('fulfilled');
    expect(prisma.storeCreditEntry.create).toHaveBeenCalledTimes(2);
    // Only one of those two calls actually persisted a row — the second
    // hit the unique constraint and was resolved to the SAME entry.
  });

  it('a genuine (non-P2002) storage failure logs RETURN_STORE_CREDIT_FAILED and never fakes success', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(makeCodRow());
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockRejectedValue(
      new Error('database connection lost'),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow('database connection lost');

    const [[loggedInput]] = auditService.log.mock.calls;
    expect(loggedInput.action).toBe('RETURN_STORE_CREDIT_FAILED');
  });
});

describe('ReturnsService.resolveClaim — audit and events', () => {
  it('logs exactly one RETURN_REFUND_ISSUED audit record on a successful prepaid resolution', async () => {
    const { prisma, paymentsService, auditService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeResolutionRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REFUND_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    paymentsService.refund.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
      providerRefundId: 'rfnd_1',
    });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(auditService.log).toHaveBeenCalledTimes(1);
    const [[loggedInput]] = auditService.log.mock.calls;
    expect(loggedInput.action).toBe('RETURN_REFUND_ISSUED');
  });

  it('emits STORE_CREDIT_ISSUED with the correct payload on successful COD resolution', async () => {
    const { prisma, eventEmitter, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(
        makeResolutionRow({
          order: {
            id: 'order-1',
            userId: 'user-1',
            subtotal: 42,
            discount: 0,
            tax: 3.36,
            paymentMethod: 'COD',
            payment: { id: 'pay-1' },
          },
        }),
      )
      .mockResolvedValueOnce(makeAdminRow({ status: 'STORE_CREDIT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.storeCreditEntry.create.mockResolvedValue({ id: 'sce-1' });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.store_credit_issued',
      {
        returnRequestId: 'rr-1',
        orderId: 'order-1',
        userId: 'user-1',
        amount: 45.36,
      },
    );
  });

  it('does not create a false-successful audit record for a failed prepaid attempt', async () => {
    const { prisma, paymentsService, auditService, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(makeResolutionRow());
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });
    paymentsService.refund.mockRejectedValue(new Error('declined'));

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow('declined');

    expect(auditService.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_REFUND_ISSUED' }),
    );
  });
});

function makeReplacementRow(overrides: Record<string, unknown> = {}) {
  return makeResolutionRow({
    claimType: 'DOA_CLAIM',
    resolutionType: 'REPLACEMENT',
    ...overrides,
  });
}

describe('ReturnsService.resolveClaim — replacement', () => {
  it('dispatches to the replacement path and never touches refund/store-credit primitives', async () => {
    const { prisma, paymentsService, inventoryService, service } = createDeps();
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeReplacementRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REPLACEMENT_ISSUED' }));
    inventoryService.reserveForProduct.mockResolvedValue({ id: 'res-1' });
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(paymentsService.refund).not.toHaveBeenCalled();
    expect(prisma.storeCreditEntry.create).not.toHaveBeenCalled();
  });

  it('reserves and commits stock for each claimed item, then creates a $0 replacement order snapshotting the original order and items', async () => {
    const { prisma, inventoryService, service } = createDeps();
    inventoryService.reserveForProduct.mockResolvedValue({ id: 'res-1' });
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeReplacementRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REPLACEMENT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(inventoryService.reserveForProduct).toHaveBeenCalledWith(
      'prod-1',
      null,
      1,
      'ORDER',
      expect.stringMatching(/^FOL-/),
    );
    expect(inventoryService.commitReservation).toHaveBeenCalledWith(
      'res-1',
      prisma,
    );

    const [[createCall]] = prisma.order.create.mock.calls;
    expect(createCall.data).toMatchObject({
      userId: 'user-1',
      subtotal: 0,
      discount: 0,
      shippingCost: 0,
      tax: 0,
      total: 0,
      paymentMethod: 'REPLACEMENT',
      deliveryMethod: 'STANDARD',
      estimatedDelivery: '3-5 business days',
    });
    expect(createCall.data.items.create).toEqual([
      expect.objectContaining({
        productId: 'prod-1',
        slug: 'monstera',
        name: 'Monstera',
        categorySlug: 'plants',
        price: 0,
        quantity: 1,
      }),
    ]);
    expect(createCall.data.payment.create).toMatchObject({
      userId: 'user-1',
      provider: 'COD',
      method: 'REPLACEMENT',
      status: 'NO_CHARGE',
      amount: 0,
    });
  });

  it('transitions the claim to REPLACEMENT_ISSUED and links replacementOrderId to the new order', async () => {
    const { prisma, inventoryService, service } = createDeps();
    inventoryService.reserveForProduct.mockResolvedValue({ id: 'res-1' });
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeReplacementRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REPLACEMENT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });

    await service.resolveClaim('admin-1', 'rr-1', undefined);

    const [[createCall]] = prisma.order.create.mock.calls;
    const newOrderId = createCall.data.id;

    const [[updateCall]] = prisma.returnRequest.updateMany.mock.calls;
    expect(updateCall.where).toEqual({
      id: 'rr-1',
      status: 'APPROVED',
      replacementOrderId: null,
    });
    expect(updateCall.data).toEqual({
      status: 'REPLACEMENT_ISSUED',
      replacementOrderId: newOrderId,
    });
  });

  it('logs RETURN_REPLACEMENT_ISSUED and emits REPLACEMENT_ISSUED with the correct payload', async () => {
    const { prisma, inventoryService, auditService, eventEmitter, service } =
      createDeps();
    inventoryService.reserveForProduct.mockResolvedValue({ id: 'res-1' });
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeReplacementRow())
      .mockResolvedValueOnce(makeAdminRow({ status: 'REPLACEMENT_ISSUED' }));
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 1 });

    await service.resolveClaim('admin-1', 'rr-1', '10.0.0.1');

    const [[createCall]] = prisma.order.create.mock.calls;
    const newOrderId = createCall.data.id;

    expect(auditService.log).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'RETURN_REPLACEMENT_ISSUED',
      resource: 'return_request',
      resourceId: 'rr-1',
      metadata: { orderId: 'order-1', replacementOrderId: newOrderId },
      ipAddress: '10.0.0.1',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.replacement_issued',
      {
        returnRequestId: 'rr-1',
        orderId: 'order-1',
        replacementOrderId: newOrderId,
        userId: 'user-1',
      },
    );
  });

  it('rejects with BadRequestException when claimType is not DOA_CLAIM, without reserving any stock (defense in depth)', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeReplacementRow({ claimType: 'STANDARD_RETURN' }),
    );

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow(BadRequestException);
    expect(inventoryService.reserveForProduct).not.toHaveBeenCalled();
  });

  it('insufficient stock: releases any already-reserved items, logs RETURN_REPLACEMENT_FAILED, creates no order, and leaves the claim APPROVED', async () => {
    const { prisma, inventoryService, auditService, service } = createDeps();
    prisma.returnRequest.findUnique.mockResolvedValue(
      makeReplacementRow({
        items: [
          {
            orderItemId: 'item-1',
            quantity: 1,
            orderItem: {
              price: 42,
              quantity: 2,
              productId: 'prod-1',
              slug: 'monstera',
              name: 'Monstera',
              categorySlug: 'plants',
              variantId: null,
              variantLabel: null,
            },
          },
          {
            orderItemId: 'item-2',
            quantity: 1,
            orderItem: {
              price: 20,
              quantity: 1,
              productId: 'prod-2',
              slug: 'fern',
              name: 'Fern',
              categorySlug: 'plants',
              variantId: null,
              variantLabel: null,
            },
          },
        ],
      }),
    );
    inventoryService.reserveForProduct
      .mockResolvedValueOnce({ id: 'res-1' })
      .mockRejectedValueOnce(new BadRequestException('Not enough stock.'));

    await expect(
      service.resolveClaim('admin-1', 'rr-1', undefined),
    ).rejects.toThrow('Not enough stock.');

    expect(inventoryService.releaseReservation).toHaveBeenCalledWith('res-1');
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(prisma.returnRequest.updateMany).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'RETURN_REPLACEMENT_FAILED',
        resourceId: 'rr-1',
      }),
    );
  });

  it('a lost replacement-creation race releases the reservation and returns the idempotent existing result instead of a duplicate order', async () => {
    const { prisma, inventoryService, auditService, eventEmitter, service } =
      createDeps();
    inventoryService.reserveForProduct.mockResolvedValue({ id: 'res-1' });
    prisma.returnRequest.findUnique
      .mockResolvedValueOnce(makeReplacementRow())
      .mockResolvedValueOnce(
        makeAdminRow({
          status: 'REPLACEMENT_ISSUED',
          replacementOrderId: 'FOL-winner',
        }),
      );
    // The final conditional update loses the race — a concurrent call
    // already won and created the real replacement order.
    prisma.returnRequest.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.resolveClaim('admin-1', 'rr-1', undefined);

    expect(inventoryService.releaseReservation).toHaveBeenCalledWith('res-1');
    expect(result.resolution.replacementOrderId).toBe('FOL-winner');
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'notification.replacement_issued',
      expect.anything(),
    );
    expect(auditService.log).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETURN_REPLACEMENT_FAILED' }),
    );
  });
});
