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
    return item;
  }

  /**
   * Locks a single InventoryItem row for the rest of the enclosing
   * transaction (Postgres `SELECT ... FOR UPDATE`) so a second, concurrent
   * transaction touching the same row genuinely blocks until this one
   * commits or rolls back. This matters because Postgres's default READ
   * COMMITTED isolation does NOT do this on its own: wrapping a
   * read-then-write in `$transaction` alone still lets two concurrent
   * transactions both read the same "1 available" snapshot and both decide
   * there's room, which is exactly the oversell race this project's
   * concurrency requirements rule out (two customers, one unit left, both
   * checkouts must not succeed). Every method here that reads
   * quantityOnHand/quantityReserved and then writes a value derived from it
   * (adjustStock, reserve, reserveForProduct, commitReservation,
   * releaseReservation) goes through this instead of
   * tx.inventoryItem.findUnique. Raw SQL (not the query builder) is the only
   * way to express FOR UPDATE in Prisma; table/column names are quoted
   * verbatim to match what Prisma itself generated for this model
   * (@@map("inventory_items"), camelCase columns, no per-field @map).
   */
  private async lockItemForUpdate(
    tx: Prisma.TransactionClient,
    inventoryItemId: string,
  ): Promise<InventoryItemRecord> {
    const rows = await tx.$queryRaw<InventoryItemRecord[]>`
      SELECT "id", "sku", "productId", "variantId", "warehouseId", "quantityOnHand", "quantityReserved", "reorderPoint"
      FROM "inventory_items"
      WHERE "id" = ${inventoryItemId}
      FOR UPDATE
    `;
    const item = rows[0];
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  /** The StockReservation-row equivalent of lockItemForUpdate — closes the identical race on commitReservation/releaseReservation, where two concurrent calls for the same reservationId could otherwise both read status ACTIVE before either writes, double-committing (or double-releasing) the same hold. */
  private async lockReservationForUpdate(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ): Promise<StockReservationRecord | null> {
    const rows = await tx.$queryRaw<StockReservationRecord[]>`
      SELECT "id", "inventoryItemId", "quantity", "referenceType", "referenceId", "status", "expiresAt"
      FROM "stock_reservations"
      WHERE "id" = ${reservationId}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  /** Real, positive-or-negative stock adjustment (receiving new stock, correcting a count, recording damage/loss) — never lets on-hand go negative. */
  async adjustStock(
    inventoryItemId: string,
    delta: number,
  ): Promise<InventoryItemRecord> {
    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const item = await this.lockItemForUpdate(tx, inventoryItemId);

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
        const item = await this.lockItemForUpdate(tx, inventoryItemId);

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

        await this.syncProductCache(tx, item.productId, item.variantId);
        return reservation;
      },
    );
  }

  /**
   * Picks the first inventory item (across warehouses) with enough
   * AVAILABLE stock (onHand - already-reserved) to cover the quantity,
   * and reserves against it — this is the method checkout should call
   * when it doesn't already know which specific InventoryItem row to
   * reserve against.
   * Candidates are locked one at a time, in ascending id order, inside a
   * single transaction: consistent lock ordering across every concurrent
   * call to this method is what prevents two checkouts from deadlocking
   * each other when a product has several warehouse rows. A candidate
   * that turns out to be insufficient once locked (another transaction
   * got there first) is skipped in favor of the next one — its lock is
   * still held until this transaction ends, which is fine, it just means
   * that item is unavailable to other reservers until this one resolves.
   */
  async reserveForProduct(
    productId: string,
    variantId: string | null,
    quantity: number,
    referenceType: ReservationReferenceType,
    referenceId: string,
    ttlMinutes = DEFAULT_RESERVATION_TTL_MINUTES,
  ): Promise<StockReservationRecord> {
    if (quantity <= 0)
      throw new BadRequestException('Reservation quantity must be positive.');

    const candidates = (await this.prisma.inventoryItem.findMany({
      where: variantId
        ? { productId, variantId }
        : { productId, variantId: null },
      orderBy: { id: 'asc' },
      select: { id: true },
    })) as { id: string }[];

    if (candidates.length === 0) {
      throw new BadRequestException(
        'No inventory item exists for this product.',
      );
    }

    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        for (const { id } of candidates) {
          const item = await this.lockItemForUpdate(tx, id);
          const available = item.quantityOnHand - item.quantityReserved;
          if (available < quantity) continue;

          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { quantityReserved: item.quantityReserved + quantity },
          });
          const reservation = await tx.stockReservation.create({
            data: {
              inventoryItemId: item.id,
              quantity,
              referenceType,
              referenceId,
              expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
            },
          });
          await this.syncProductCache(tx, item.productId, item.variantId);
          return reservation;
        }
        throw new BadRequestException(
          `Not enough stock available for this item (requested ${quantity}).`,
        );
      },
    );
  }

  /**
   * A reservation becomes a real deduction — called once a payment is
   * confirmed (PaymentsService.confirmAndCreateOrder). Accepts an optional
   * already-open `externalTx`: confirmAndCreateOrder commits every line's
   * reservation AND creates the Order AND updates Payment.orderId inside
   * one shared transaction, precisely so this system never reaches
   * "inventory decremented but order missing" — a crash between two of
   * those three steps must roll all of them back, which only works if
   * they share one transaction rather than each committing independently.
   */
  async commitReservation(
    reservationId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<StockReservationRecord> {
    const run = async (tx: Prisma.TransactionClient) => {
      const reservation = await this.lockReservationForUpdate(
        tx,
        reservationId,
      );
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Cannot commit a reservation with status ${reservation.status}.`,
        );
      }

      const item = await this.lockItemForUpdate(
        tx,
        reservation.inventoryItemId,
      );
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
      await this.syncProductCache(tx, item.productId, item.variantId);
      return updated;
    };
    return externalTx
      ? await run(externalTx)
      : await this.prisma.$transaction(run);
  }

  /**
   * Cancels a hold (cart abandoned, checkout failed, payment expired) —
   * the reserved quantity becomes available again without ever having
   * touched on-hand. Same optional-`externalTx` shape as commitReservation,
   * for the same reason: a caller marking a Payment FAILED/EXPIRED alongside
   * releasing its reservations wants both to commit or roll back together.
   */
  async releaseReservation(
    reservationId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<StockReservationRecord> {
    const run = async (tx: Prisma.TransactionClient) => {
      const reservation = await this.lockReservationForUpdate(
        tx,
        reservationId,
      );
      if (!reservation) throw new NotFoundException('Reservation not found');
      if (reservation.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Cannot release a reservation with status ${reservation.status}.`,
        );
      }

      const item = await this.lockItemForUpdate(
        tx,
        reservation.inventoryItemId,
      );
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
      await this.syncProductCache(tx, item.productId, item.variantId);
      return updated;
    };
    return externalTx
      ? await run(externalTx)
      : await this.prisma.$transaction(run);
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
