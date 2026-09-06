/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  InventoryItemRecord,
  StockReservationRecord,
  ReservationReferenceType,
} from './inventory.types';

const DEFAULT_RESERVATION_TTL_MINUTES = 15;

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The one place Product.stockCount/inStock and ProductVariant.inStock
   * (both Phase 2 fields, already read by ProductsService's existing,
   * already-tested query path) get written. stockCount/inStock reflect
   * AVAILABLE stock (on-hand minus active reservations) — what's actually
   * purchasable right now, not just what's physically on a shelf
   * somewhere with no way to buy it because it's all reserved. Always run
   * inside the same transaction as whatever stock change triggered it, so
   * the cache is never observably stale even for a single read.
   */
  private async syncProductCache(
    tx: Prisma.TransactionClient,
    productId: string,
    variantId: string | null,
  ) {
    const productItems = await tx.inventoryItem.findMany({
      where: { productId },
    });
    const productAvailable = productItems.reduce(
      (
        sum: number,
        item: { quantityOnHand: number; quantityReserved: number },
      ) => sum + Math.max(0, item.quantityOnHand - item.quantityReserved),
      0,
    );
    await tx.product.update({
      where: { id: productId },
      data: { stockCount: productAvailable, inStock: productAvailable > 0 },
    });

    if (variantId) {
      const variantItems = await tx.inventoryItem.findMany({
        where: { variantId },
      });
      const variantAvailable = variantItems.reduce(
        (
          sum: number,
          item: { quantityOnHand: number; quantityReserved: number },
        ) => sum + Math.max(0, item.quantityOnHand - item.quantityReserved),
        0,
      );
      await tx.productVariant.update({
        where: { id: variantId },
        data: { inStock: variantAvailable > 0 },
      });
    }
  }

  async findItemOrThrow(id: string): Promise<InventoryItemRecord> {
    const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item as InventoryItemRecord;
  }

  /** Real, positive-or-negative stock adjustment (receiving new stock, correcting a count, recording damage/loss) — never lets on-hand go negative. */
  async adjustStock(
    inventoryItemId: string,
    delta: number,
  ): Promise<InventoryItemRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const item = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
        });
        if (!item) throw new NotFoundException('Inventory item not found');

        const newQuantity = item.quantityOnHand + delta;
        if (newQuantity < 0) {
          throw new BadRequestException(
            `Adjustment would leave quantityOnHand negative (${item.quantityOnHand} + ${delta} = ${newQuantity}).`,
          );
        }

        const updated = await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { quantityOnHand: newQuantity },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- item.productId/variantId are `any` here only because Prisma.TransactionClient resolves to `any` in this pre-generation sandbox; resolves once real generation succeeds.
        await this.syncProductCache(tx, item.productId, item.variantId);
        return updated;
      },
    );
  }

  /** Sum of (onHand - reserved) across every warehouse carrying this product/variant — the real-time "can this actually be bought right now" number. */
  async getAvailability(
    productId: string,
    variantId?: string,
  ): Promise<number> {
    const items = await this.prisma.inventoryItem.findMany({
      where: variantId ? { productId, variantId } : { productId },
    });
    return items.reduce(
      (
        sum: number,
        item: { quantityOnHand: number; quantityReserved: number },
      ) => sum + Math.max(0, item.quantityOnHand - item.quantityReserved),
      0,
    );
  }

  /**
   * Decrements real stock for a product/variant at checkout time —
   * simpler than the reserve→commit flow above (no separate hold period
   * to manage), used when an order is placed directly rather than going
   * through an explicit reservation first. Picks the first inventory item
   * (across warehouses) with enough on-hand stock to fully cover the
   * quantity; a real multi-warehouse fulfillment system would split a
   * single line across warehouses and pick by proximity/cost, which is
   * out of scope here — this project's warehouse model exists to prove
   * SKU/stock tracking works, not to implement fulfillment optimization.
   */
  /** Returns the id of the inventory item actually decremented from, so a caller that might need to reverse this later (Phase 1 payments: an order whose payment fails or expires — see PaymentsService/the expire-stale-payments job) knows precisely which row to restore, rather than re-deriving "an" item for the product and risking restoring to a different warehouse row than the one actually decremented. */
  async decrementForProduct(
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<string> {
    const items = (await this.prisma.inventoryItem.findMany({
      where: variantId
        ? { productId, variantId }
        : { productId, variantId: null },
    })) as InventoryItemRecord[];

    const sufficient = items.find(
      (item) => item.quantityOnHand - item.quantityReserved >= quantity,
    );
    if (!sufficient) {
      throw new BadRequestException(
        `Not enough stock available for this item (requested ${quantity}).`,
      );
    }

    await this.adjustStock(sufficient.id, -quantity);
    return sufficient.id;
  }

  /** The precise inverse of decrementForProduct's effect on a single inventory item — gives stock back to the exact row it was taken from. Named separately from adjustStock (rather than calling adjustStock(id, +qty) directly at every call site) so a payment-expiry/failure code path reads as "restore this order line's stock," not an opaque signed-delta call. */
  async restoreQuantity(inventoryItemId: string, quantity: number): Promise<void> {
    await this.adjustStock(inventoryItemId, quantity);
  }

  /**
   * Holds stock against a cart/order without yet deducting it from
   * on-hand — rejects if the requested quantity exceeds what's actually
   * available (onHand - already-reserved), so two people can't both
   * reserve the last unit.
   */
  async reserve(
    inventoryItemId: string,
    quantity: number,
    referenceType: ReservationReferenceType,
    referenceId: string,
    ttlMinutes = DEFAULT_RESERVATION_TTL_MINUTES,
  ): Promise<StockReservationRecord> {
    if (quantity <= 0)
      throw new BadRequestException('Reservation quantity must be positive.');

    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const item = await tx.inventoryItem.findUnique({
          where: { id: inventoryItemId },
        });
        if (!item) throw new NotFoundException('Inventory item not found');

        const available = item.quantityOnHand - item.quantityReserved;
        if (quantity > available) {
          throw new BadRequestException(
            `Only ${available} unit(s) available — cannot reserve ${quantity}.`,
          );
        }

        await tx.inventoryItem.update({
          where: { id: inventoryItemId },
          data: { quantityReserved: item.quantityReserved + quantity },
        });

        const reservation = await tx.stockReservation.create({
          data: {
            inventoryItemId,
            quantity,
            referenceType,
            referenceId,
            expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- item.productId/variantId are `any` here only because Prisma.TransactionClient resolves to `any` in this pre-generation sandbox; resolves once real generation succeeds.
        await this.syncProductCache(tx, item.productId, item.variantId);
        return reservation;
      },
    );
  }

  /** A reservation becomes a real deduction — called when an order is actually placed (Phase 5/6's job to call this, not this phase's to build that flow). */
  async commitReservation(
    reservationId: string,
  ): Promise<StockReservationRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const reservation = await tx.stockReservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation) throw new NotFoundException('Reservation not found');
        if (reservation.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Cannot commit a reservation with status ${reservation.status}.`,
          );
        }

        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: reservation.inventoryItemId },
        });
        await tx.inventoryItem.update({
          where: { id: reservation.inventoryItemId },
          data: {
            quantityOnHand: item.quantityOnHand - reservation.quantity,
            quantityReserved: item.quantityReserved - reservation.quantity,
          },
        });
        const updated = await tx.stockReservation.update({
          where: { id: reservationId },
          data: { status: 'COMMITTED' },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- item.productId/variantId are `any` here only because Prisma.TransactionClient resolves to `any` in this pre-generation sandbox; resolves once real generation succeeds.
        await this.syncProductCache(tx, item.productId, item.variantId);
        return updated;
      },
    );
  }

  /** Cancels a hold (cart abandoned, checkout failed) — the reserved quantity becomes available again without ever having touched on-hand. */
  async releaseReservation(
    reservationId: string,
  ): Promise<StockReservationRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const reservation = await tx.stockReservation.findUnique({
          where: { id: reservationId },
        });
        if (!reservation) throw new NotFoundException('Reservation not found');
        if (reservation.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Cannot release a reservation with status ${reservation.status}.`,
          );
        }

        const item = await tx.inventoryItem.findUniqueOrThrow({
          where: { id: reservation.inventoryItemId },
        });
        await tx.inventoryItem.update({
          where: { id: reservation.inventoryItemId },
          data: {
            quantityReserved: item.quantityReserved - reservation.quantity,
          },
        });
        const updated = await tx.stockReservation.update({
          where: { id: reservationId },
          data: { status: 'RELEASED' },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- item.productId/variantId are `any` here only because Prisma.TransactionClient resolves to `any` in this pre-generation sandbox; resolves once real generation succeeds.
        await this.syncProductCache(tx, item.productId, item.variantId);
        return updated;
      },
    );
  }

  /** Sweeps reservations past their expiry (an abandoned cart that was never explicitly released) — meant to be called on a schedule once Phase 8's BullMQ background jobs exist; exposed here as a real, callable method rather than dead code waiting for that infrastructure. */
  async releaseExpiredReservations(): Promise<number> {
    const expired = await this.prisma.stockReservation.findMany({
      where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    });
    for (const reservation of expired as StockReservationRecord[]) {
      await this.releaseReservation(reservation.id);
    }
    return expired.length;
  }

  /**
   * Items where real on-hand stock has fallen to or below their reorder
   * point — the actual admin-dashboard "needs restocking" signal.
   * Filtered in application code rather than in the database query
   * itself: Prisma's standard query builder can only compare a column
   * against a literal value, not against another column
   * (quantityOnHand vs reorderPoint), and this catalog's real scale (a
   * few dozen products) makes fetching active items and filtering in
   * memory the honest, simple choice rather than reaching for raw SQL
   * prematurely. A catalog with many thousands of SKUs would need a raw
   * query or a computed/indexed column instead — a real scale limit,
   * stated here rather than silently assumed away.
   */
  async getLowStockItems(): Promise<InventoryItemRecord[]> {
    const items = (await this.prisma.inventoryItem.findMany({
      include: {
        product: { select: { name: true, slug: true } },
        warehouse: { select: { name: true, code: true } },
      },
    })) as InventoryItemRecord[];
    return items.filter((item) => item.quantityOnHand <= item.reorderPoint);
  }
}
