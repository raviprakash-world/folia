// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import type {
  InventoryItemRecord,
  StockReservationRecord,
} from './inventory.types';

function makeItem(
  overrides: Partial<InventoryItemRecord> = {},
): InventoryItemRecord {
  return {
    id: 'inv-1',
    sku: 'MONSTERA-SM-MAIN',
    productId: 'prod-1',
    variantId: 'var-1',
    warehouseId: 'wh-1',
    quantityOnHand: 10,
    quantityReserved: 2,
    reorderPoint: 0,
    ...overrides,
  };
}

function makeReservation(
  overrides: Partial<StockReservationRecord> = {},
): StockReservationRecord {
  return {
    id: 'res-1',
    inventoryItemId: 'inv-1',
    quantity: 3,
    referenceType: 'CART',
    referenceId: 'cart-abc',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + 1000 * 60 * 15),
    ...overrides,
  };
}

/**
 * Every real mutation now goes through raw `SELECT ... FOR UPDATE` (see
 * InventoryService.lockItemForUpdate/lockReservationForUpdate) instead of
 * `tx.inventoryItem.findUnique` — this mock's `$queryRaw` inspects the SQL
 * text to know which table (inventory_items vs stock_reservations) a given
 * call is locking, and answers from whichever fixture list was configured,
 * so the same mock function serves both lock helpers without them
 * colliding.
 */
function createMockPrisma() {
  const tx = {
    $queryRaw: jest.fn(),
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    product: { update: jest.fn() },
    productVariant: { update: jest.fn() },
    stockReservation: {
      create: jest.fn<
        Promise<StockReservationRecord>,
        [
          {
            data: {
              quantity: number;
              referenceType: string;
              referenceId: string;
              inventoryItemId: string;
            };
          },
        ]
      >(),
      update: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (t: typeof tx) => unknown) =>
      callback(tx),
    ),
    inventoryItem: { findUnique: jest.fn(), findMany: jest.fn() },
    stockReservation: { findMany: jest.fn() },
  };
  return { prisma, tx };
}

/** Wires a mock's `$queryRaw` to answer FOR UPDATE lookups from these fixture lists, keyed by id, disambiguated by which table the raw SQL names. */
function mockLocks(
  tx: ReturnType<typeof createMockPrisma>['tx'],
  fixtures: {
    items?: InventoryItemRecord[];
    reservations?: StockReservationRecord[];
  },
) {
  const items = fixtures.items ?? [];
  const reservations = fixtures.reservations ?? [];
  tx.$queryRaw.mockImplementation(
    (strings: TemplateStringsArray, id: string) => {
      const sql = strings.join('');
      if (sql.includes('inventory_items')) {
        const found = items.find((i) => i.id === id);
        return Promise.resolve(found ? [found] : []);
      }
      if (sql.includes('stock_reservations')) {
        const found = reservations.find((r) => r.id === id);
        return Promise.resolve(found ? [found] : []);
      }
      return Promise.resolve([]);
    },
  );
}

describe('InventoryService', () => {
  describe('adjustStock', () => {
    it('increases quantityOnHand by a positive delta and syncs the product cache', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, { items: [makeItem()] });
      tx.inventoryItem.update.mockResolvedValue(
        makeItem({ quantityOnHand: 15 }),
      );
      tx.inventoryItem.findMany.mockResolvedValue([
        { quantityOnHand: 15, quantityReserved: 2 },
      ]);
      const service = new InventoryService(prisma as never);

      await service.adjustStock('inv-1', 5);

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantityOnHand: 15 },
      });
      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { stockCount: 13, inStock: true },
      });
    });

    it('rejects an adjustment that would leave quantityOnHand negative', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, { items: [makeItem({ quantityOnHand: 3 })] });
      const service = new InventoryService(prisma as never);

      await expect(service.adjustStock('inv-1', -10)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown inventory item', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, { items: [] });
      const service = new InventoryService(prisma as never);
      await expect(service.adjustStock('unknown', 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAvailability', () => {
    it('sums (onHand - reserved) across every matching item', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([
        { quantityOnHand: 10, quantityReserved: 2 },
        { quantityOnHand: 5, quantityReserved: 5 },
      ]);
      const service = new InventoryService(prisma as never);

      expect(await service.getAvailability('prod-1')).toBe(8); // (10-2) + (5-5)
    });

    it('never lets a single item contribute a negative amount (floors at 0)', async () => {
      const { prisma } = createMockPrisma();
      // Reserved somehow exceeding on-hand shouldn't make availability negative overall.
      prisma.inventoryItem.findMany.mockResolvedValue([
        { quantityOnHand: 5, quantityReserved: 8 },
      ]);
      const service = new InventoryService(prisma as never);

      expect(await service.getAvailability('prod-1')).toBe(0);
    });

    it('filters by variantId when provided', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);

      await service.getAvailability('prod-1', 'var-1');
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1', variantId: 'var-1' },
      });
    });
  });

  describe('reserve', () => {
    it('rejects a reservation quantity that exceeds availability', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 8 })], // 2 available
      });
      const service = new InventoryService(prisma as never);

      await expect(
        service.reserve('inv-1', 5, 'CART', 'cart-1'),
      ).rejects.toThrow(BadRequestException);
      expect(tx.stockReservation.create).not.toHaveBeenCalled();
    });

    it('rejects a non-positive quantity outright', async () => {
      const { prisma } = createMockPrisma();
      const service = new InventoryService(prisma as never);
      await expect(
        service.reserve('inv-1', 0, 'CART', 'cart-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('succeeds when quantity is within availability, increments quantityReserved, and creates a reservation', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 2 })], // 8 available
      });
      tx.stockReservation.create.mockResolvedValue(makeReservation());
      const service = new InventoryService(prisma as never);

      await service.reserve('inv-1', 5, 'CART', 'cart-1');

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantityReserved: 7 },
      });
      const createCall = tx.stockReservation.create.mock.calls[0][0];
      expect(createCall.data.quantity).toBe(5);
      expect(createCall.data.referenceId).toBe('cart-1');
    });

    it('accepts the new PAYMENT reference type (Phase 2)', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 0 })],
      });
      tx.stockReservation.create.mockResolvedValue(
        makeReservation({ referenceType: 'PAYMENT', referenceId: 'payment-1' }),
      );
      const service = new InventoryService(prisma as never);

      await service.reserve('inv-1', 1, 'PAYMENT', 'payment-1');

      const createCall = tx.stockReservation.create.mock.calls[0][0];
      expect(createCall.data.referenceType).toBe('PAYMENT');
    });
  });

  describe('reserve / lockItemForUpdate — locking clause itself', () => {
    it('issues a real SELECT ... FOR UPDATE against inventory_items, not a plain read', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 2 })],
      });
      tx.stockReservation.create.mockResolvedValue(makeReservation());
      const service = new InventoryService(prisma as never);

      await service.reserve('inv-1', 5, 'CART', 'cart-1');

      expect(tx.$queryRaw).toHaveBeenCalled();
      const [strings] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray];
      const sql = strings.join('');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).toContain('inventory_items');
    });
  });

  describe('reserveForProduct', () => {
    it('reserves against the first candidate (in ascending id order) with enough available stock', async () => {
      const { prisma, tx } = createMockPrisma();
      const low = makeItem({
        id: 'inv-a-low',
        quantityOnHand: 2,
        quantityReserved: 0,
      });
      const sufficient = makeItem({
        id: 'inv-b-sufficient',
        quantityOnHand: 10,
        quantityReserved: 2,
      });
      prisma.inventoryItem.findMany.mockResolvedValue([
        { id: low.id },
        { id: sufficient.id },
      ]);
      mockLocks(tx, { items: [low, sufficient] });
      tx.stockReservation.create.mockResolvedValue(
        makeReservation({ inventoryItemId: sufficient.id }),
      );
      const service = new InventoryService(prisma as never);

      await service.reserveForProduct(
        'prod-1',
        null,
        5,
        'PAYMENT',
        'payment-1',
      );

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: sufficient.id },
        data: { quantityReserved: 7 },
      });
    });

    it('rejects when no candidate has enough available stock', async () => {
      const { prisma, tx } = createMockPrisma();
      const only = makeItem({
        id: 'inv-1',
        quantityOnHand: 2,
        quantityReserved: 0,
      });
      prisma.inventoryItem.findMany.mockResolvedValue([{ id: only.id }]);
      mockLocks(tx, { items: [only] });
      const service = new InventoryService(prisma as never);

      await expect(
        service.reserveForProduct('prod-1', null, 5, 'PAYMENT', 'payment-1'),
      ).rejects.toThrow(BadRequestException);
      expect(tx.stockReservation.create).not.toHaveBeenCalled();
    });

    it('rejects outright when no inventory item exists at all for the product', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);

      await expect(
        service.reserveForProduct('prod-1', null, 1, 'PAYMENT', 'payment-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('scopes the candidate lookup to a null variantId explicitly for variant-less products, not "any variant"', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);

      await service
        .reserveForProduct('prod-1', null, 1, 'PAYMENT', 'payment-1')
        .catch(() => undefined);
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1', variantId: null },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
    });

    it('rejects a non-positive quantity outright, before ever querying candidates', async () => {
      const { prisma } = createMockPrisma();
      const service = new InventoryService(prisma as never);
      await expect(
        service.reserveForProduct('prod-1', null, 0, 'PAYMENT', 'payment-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inventoryItem.findMany).not.toHaveBeenCalled();
    });
  });

  /**
   * The mandatory Phase 2 proof: with only one unit in stock, two
   * concurrent reservation attempts for that unit must not both succeed.
   * This doesn't exercise real Postgres (Docker/Postgres was unavailable
   * while this was written — see the Phase 2 gate report) — it simulates
   * the exact mutual-exclusion guarantee `SELECT ... FOR UPDATE` gives a
   * transaction in real Postgres (a second transaction's lock acquisition
   * on the same row genuinely blocks until the first transaction's
   * $transaction callback finishes, then observes whatever the first one
   * committed) via an in-memory mutex keyed to the same lock/unlock points
   * this service actually calls. It proves the SERVICE's own logic is
   * correct under that guarantee; it is not a substitute for the live
   * integration test (see inventory-concurrency.e2e-spec.ts) that proves
   * Postgres itself is actually invoked correctly end to end.
   */
  describe('concurrency: last-unit-in-stock race (row-locking simulation)', () => {
    function createSerializingMockPrisma(initial: InventoryItemRecord) {
      let item = { ...initial };
      const reservations: StockReservationRecord[] = [];
      let locked = false;
      const waiters: (() => void)[] = [];

      const acquire = async () => {
        while (locked) {
          await new Promise<void>((resolve) => waiters.push(resolve));
        }
        locked = true;
      };
      const release = () => {
        locked = false;
        const next = waiters.shift();
        if (next) next();
      };

      const tx = {
        $queryRaw: jest.fn(async () => {
          await acquire();
          return [{ ...item }];
        }),
        inventoryItem: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(
            ({ data }: { data: Partial<InventoryItemRecord> }) => {
              item = { ...item, ...data };
              return Promise.resolve({ ...item });
            },
          ),
        },
        product: { update: jest.fn() },
        productVariant: { update: jest.fn() },
        stockReservation: {
          create: jest.fn(
            ({
              data,
            }: {
              data: Omit<
                StockReservationRecord,
                'id' | 'status' | 'expiresAt'
              > & {
                expiresAt: Date;
              };
            }) => {
              const reservation: StockReservationRecord = {
                id: `res-${reservations.length + 1}`,
                status: 'ACTIVE',
                ...data,
              };
              reservations.push(reservation);
              return Promise.resolve(reservation);
            },
          ),
        },
      };

      const prisma = {
        $transaction: jest.fn(
          async (callback: (t: typeof tx) => Promise<unknown>) => {
            try {
              return await callback(tx);
            } finally {
              release();
            }
          },
        ),
        inventoryItem: {
          findMany: jest.fn().mockResolvedValue([{ id: item.id }]),
        },
      };

      return {
        prisma,
        getItem: () => item,
        getReservations: () => reservations,
      };
    }

    it('lets exactly one of two concurrent reserveForProduct calls for the last unit succeed', async () => {
      const { prisma, getItem, getReservations } = createSerializingMockPrisma(
        makeItem({
          id: 'inv-last',
          productId: 'prod-last',
          variantId: null,
          quantityOnHand: 1,
          quantityReserved: 0,
        }),
      );
      const service = new InventoryService(prisma as never);

      const results = await Promise.allSettled([
        service.reserveForProduct('prod-last', null, 1, 'PAYMENT', 'payment-A'),
        service.reserveForProduct('prod-last', null, 1, 'PAYMENT', 'payment-B'),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
      // The item was never oversold: exactly 1 reservation exists, and
      // quantityReserved never exceeded quantityOnHand.
      expect(getReservations()).toHaveLength(1);
      expect(getItem().quantityReserved).toBe(1);
      expect(getItem().quantityOnHand).toBe(1);
    });

    it('lets exactly one of ten concurrent reserveForProduct calls for the last unit succeed', async () => {
      const { prisma, getReservations } = createSerializingMockPrisma(
        makeItem({
          id: 'inv-last',
          productId: 'prod-last',
          variantId: null,
          quantityOnHand: 1,
          quantityReserved: 0,
        }),
      );
      const service = new InventoryService(prisma as never);

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          service.reserveForProduct(
            'prod-last',
            null,
            1,
            'PAYMENT',
            `payment-${i}`,
          ),
        ),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(9);
      expect(getReservations()).toHaveLength(1);
    });
  });

  describe('commitReservation', () => {
    it('rejects committing a reservation that is not ACTIVE', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ status: 'RELEASED' })],
      });
      const service = new InventoryService(prisma as never);
      await expect(service.commitReservation('res-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for an unknown reservation', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, { reservations: [] });
      const service = new InventoryService(prisma as never);
      await expect(service.commitReservation('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('on success: deducts BOTH quantityOnHand and quantityReserved, marks COMMITTED', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ quantity: 3 })],
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 3 })],
      });
      tx.stockReservation.update.mockResolvedValue(
        makeReservation({ status: 'COMMITTED' }),
      );
      const service = new InventoryService(prisma as never);

      await service.commitReservation('res-1');

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantityOnHand: 7, quantityReserved: 0 },
      });
      expect(tx.stockReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'COMMITTED' },
      });
    });

    it('runs inside an externally supplied transaction instead of opening its own, when one is given', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ quantity: 3 })],
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 3 })],
      });
      tx.stockReservation.update.mockResolvedValue(
        makeReservation({ status: 'COMMITTED' }),
      );
      const service = new InventoryService(prisma as never);

      await service.commitReservation('res-1', tx as never);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantityOnHand: 7, quantityReserved: 0 },
      });
    });
  });

  describe('releaseReservation', () => {
    it('rejects releasing a reservation that is not ACTIVE', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ status: 'COMMITTED' })],
      });
      const service = new InventoryService(prisma as never);
      await expect(service.releaseReservation('res-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('on success: decrements ONLY quantityReserved (never quantityOnHand), marks RELEASED', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ quantity: 3 })],
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 3 })],
      });
      tx.stockReservation.update.mockResolvedValue(
        makeReservation({ status: 'RELEASED' }),
      );
      const service = new InventoryService(prisma as never);

      await service.releaseReservation('res-1');

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { quantityReserved: 0 }, // note: no quantityOnHand key at all in this call
      });
      expect(tx.stockReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-1' },
        data: { status: 'RELEASED' },
      });
    });

    it('runs inside an externally supplied transaction instead of opening its own, when one is given', async () => {
      const { prisma, tx } = createMockPrisma();
      mockLocks(tx, {
        reservations: [makeReservation({ quantity: 3 })],
        items: [makeItem({ quantityOnHand: 10, quantityReserved: 3 })],
      });
      tx.stockReservation.update.mockResolvedValue(
        makeReservation({ status: 'RELEASED' }),
      );
      const service = new InventoryService(prisma as never);

      await service.releaseReservation('res-1', tx as never);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('releaseExpiredReservations', () => {
    it('releases every ACTIVE reservation past its expiry and reports how many', async () => {
      const { prisma, tx } = createMockPrisma();
      prisma.stockReservation.findMany.mockResolvedValue([
        makeReservation({ id: 'res-1' }),
        makeReservation({ id: 'res-2' }),
      ]);
      mockLocks(tx, {
        reservations: [
          makeReservation({ id: 'res-1' }),
          makeReservation({ id: 'res-2' }),
        ],
        items: [makeItem()],
      });
      tx.stockReservation.update.mockResolvedValue(
        makeReservation({ status: 'RELEASED' }),
      );
      const service = new InventoryService(prisma as never);

      const count = await service.releaseExpiredReservations();
      expect(count).toBe(2);
    });

    it('returns 0 when nothing is expired', async () => {
      const { prisma } = createMockPrisma();
      prisma.stockReservation.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);
      expect(await service.releaseExpiredReservations()).toBe(0);
    });
  });
});

describe('InventoryService.getLowStockItems', () => {
  it('includes an item whose on-hand stock has fallen to its reorder point', async () => {
    const { prisma } = createMockPrisma();
    const service = new InventoryService(prisma as never);
    prisma.inventoryItem.findMany.mockResolvedValue([
      makeItem({ id: 'low', quantityOnHand: 3, reorderPoint: 3 }),
    ]);
    const result = await service.getLowStockItems();
    expect(result.map((i) => i.id)).toEqual(['low']);
  });

  it('includes an item that has fallen below its reorder point', async () => {
    const { prisma } = createMockPrisma();
    const service = new InventoryService(prisma as never);
    prisma.inventoryItem.findMany.mockResolvedValue([
      makeItem({ id: 'critical', quantityOnHand: 0, reorderPoint: 5 }),
    ]);
    const result = await service.getLowStockItems();
    expect(result.map((i) => i.id)).toEqual(['critical']);
  });

  it('excludes an item that is genuinely well-stocked', async () => {
    const { prisma } = createMockPrisma();
    const service = new InventoryService(prisma as never);
    prisma.inventoryItem.findMany.mockResolvedValue([
      makeItem({ id: 'healthy', quantityOnHand: 50, reorderPoint: 5 }),
    ]);
    const result = await service.getLowStockItems();
    expect(result).toHaveLength(0);
  });

  it('correctly filters a mixed set, not just returning everything or nothing', async () => {
    const { prisma } = createMockPrisma();
    const service = new InventoryService(prisma as never);
    prisma.inventoryItem.findMany.mockResolvedValue([
      makeItem({ id: 'low', quantityOnHand: 2, reorderPoint: 5 }),
      makeItem({ id: 'healthy', quantityOnHand: 50, reorderPoint: 5 }),
    ]);
    const result = await service.getLowStockItems();
    expect(result.map((i) => i.id)).toEqual(['low']);
  });
});
