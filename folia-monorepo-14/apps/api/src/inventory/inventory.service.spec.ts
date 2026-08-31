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

function createMockPrisma() {
  const tx = {
    inventoryItem: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    product: { update: jest.fn() },
    productVariant: { update: jest.fn() },
    stockReservation: {
      create: jest.fn<
        Promise<StockReservationRecord>,
        [{ data: { quantity: number; referenceId: string } }]
      >(),
      findUnique: jest.fn(),
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

describe('InventoryService', () => {
  describe('adjustStock', () => {
    it('increases quantityOnHand by a positive delta and syncs the product cache', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.inventoryItem.findUnique.mockResolvedValue(makeItem());
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
      tx.inventoryItem.findUnique.mockResolvedValue(
        makeItem({ quantityOnHand: 3 }),
      );
      const service = new InventoryService(prisma as never);

      await expect(service.adjustStock('inv-1', -10)).rejects.toThrow(
        BadRequestException,
      );
      expect(tx.inventoryItem.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown inventory item', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.inventoryItem.findUnique.mockResolvedValue(null);
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
      tx.inventoryItem.findUnique.mockResolvedValue(
        makeItem({ quantityOnHand: 10, quantityReserved: 8 }),
      ); // 2 available
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
      tx.inventoryItem.findUnique.mockResolvedValue(
        makeItem({ quantityOnHand: 10, quantityReserved: 2 }),
      ); // 8 available
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
  });

  describe('commitReservation', () => {
    it('rejects committing a reservation that is not ACTIVE', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.stockReservation.findUnique.mockResolvedValue(
        makeReservation({ status: 'RELEASED' }),
      );
      const service = new InventoryService(prisma as never);
      await expect(service.commitReservation('res-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('on success: deducts BOTH quantityOnHand and quantityReserved, marks COMMITTED', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.stockReservation.findUnique.mockResolvedValue(
        makeReservation({ quantity: 3 }),
      );
      tx.inventoryItem.findUniqueOrThrow.mockResolvedValue(
        makeItem({ quantityOnHand: 10, quantityReserved: 3 }),
      );
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
  });

  describe('releaseReservation', () => {
    it('rejects releasing a reservation that is not ACTIVE', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.stockReservation.findUnique.mockResolvedValue(
        makeReservation({ status: 'COMMITTED' }),
      );
      const service = new InventoryService(prisma as never);
      await expect(service.releaseReservation('res-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('on success: decrements ONLY quantityReserved (never quantityOnHand), marks RELEASED', async () => {
      const { prisma, tx } = createMockPrisma();
      tx.stockReservation.findUnique.mockResolvedValue(
        makeReservation({ quantity: 3 }),
      );
      tx.inventoryItem.findUniqueOrThrow.mockResolvedValue(
        makeItem({ quantityOnHand: 10, quantityReserved: 3 }),
      );
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
  });

  describe('decrementForProduct', () => {
    it('picks an inventory item with enough available stock and decrements its onHand', async () => {
      const { prisma, tx } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'inv-low',
          quantityOnHand: 2,
          quantityReserved: 0,
          productId: 'prod-1',
          variantId: null,
        },
        {
          id: 'inv-sufficient',
          quantityOnHand: 10,
          quantityReserved: 2,
          productId: 'prod-1',
          variantId: null,
        },
      ]);
      tx.inventoryItem.findUnique.mockResolvedValue(
        makeItem({
          id: 'inv-sufficient',
          quantityOnHand: 10,
          quantityReserved: 2,
        }),
      );
      tx.inventoryItem.update.mockResolvedValue(
        makeItem({ id: 'inv-sufficient', quantityOnHand: 5 }),
      );
      tx.inventoryItem.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);

      await service.decrementForProduct('prod-1', null, 5);

      expect(tx.inventoryItem.update).toHaveBeenCalledWith({
        where: { id: 'inv-sufficient' },
        data: { quantityOnHand: 5 },
      });
    });

    it('rejects when no single item has enough available stock', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          quantityOnHand: 2,
          quantityReserved: 0,
          productId: 'prod-1',
          variantId: null,
        },
      ]);
      const service = new InventoryService(prisma as never);

      await expect(
        service.decrementForProduct('prod-1', null, 5),
      ).rejects.toThrow(BadRequestException);
    });

    it('scopes the lookup to a null variantId explicitly for variant-less products, not "any variant"', async () => {
      const { prisma } = createMockPrisma();
      prisma.inventoryItem.findMany.mockResolvedValue([]);
      const service = new InventoryService(prisma as never);

      await service
        .decrementForProduct('prod-1', null, 1)
        .catch(() => undefined);
      expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
        where: { productId: 'prod-1', variantId: null },
      });
    });
  });

  describe('releaseExpiredReservations', () => {
    it('releases every ACTIVE reservation past its expiry and reports how many', async () => {
      const { prisma, tx } = createMockPrisma();
      prisma.stockReservation.findMany.mockResolvedValue([
        makeReservation({ id: 'res-1' }),
        makeReservation({ id: 'res-2' }),
      ]);
      tx.stockReservation.findUnique.mockImplementation(
        (args: { where: { id: string } }) =>
          Promise.resolve(makeReservation({ id: args.where.id })),
      );
      tx.inventoryItem.findUniqueOrThrow.mockResolvedValue(makeItem());
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
