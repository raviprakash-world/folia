import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SellerLedgerEntry } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Marketplace Phase 9 — the real, persisted seller financial ledger
 * (SellerLedgerEntry, schema-forward-declared in Phase 1). A seller's
 * balance is ALWAYS SUM(amount) over every entry, computed on read, never
 * a cached mutable column — see this model's own schema.prisma comment.
 * SALE/COMMISSION entries are written by PaymentsService.confirmAndCreateOrder
 * (Marketplace Phase 8's commission math flows straight into this ledger,
 * inside the same transaction); PAYOUT entries are written by
 * SellerPayoutService.adminMarkPaid; ADJUSTMENT entries are written here,
 * directly, by an admin. REFUND entries are NOT written by anything yet —
 * this codebase has no seller-scoped refund trigger point today (the
 * existing PaymentsService.refund operates at the whole-Payment level,
 * not per-OrderSellerGroup); wiring a real REFUND entry is Marketplace
 * Phase 11's job (returns/refunds/replacements), not this one's — see this
 * phase's own gate report for why that's not built here as a placeholder.
 */
@Injectable()
export class SellerLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Writes SALE (the group's gross subtotal) + COMMISSION (Folia's cut,
   * negative) for one seller's OrderSellerGroup — the seller's net proceeds
   * from this order are exactly SALE.amount + COMMISSION.amount. Called
   * from inside PaymentsService.confirmAndCreateOrder's own transaction, so
   * accepts that transaction client rather than opening its own — same
   * externalTx convention as InventoryService.commitReservation and
   * SellerCommissionService.resolveEffectiveRate.
   */
  async recordOrderProceeds(
    tx: Prisma.TransactionClient,
    sellerId: string,
    orderSellerGroupId: string,
    subtotal: number,
    commissionAmount: number,
  ): Promise<void> {
    await tx.sellerLedgerEntry.createMany({
      data: [
        {
          sellerId,
          type: 'SALE',
          amount: subtotal,
          referenceType: 'ORDER_SELLER_GROUP',
          referenceId: orderSellerGroupId,
        },
        {
          sellerId,
          type: 'COMMISSION',
          amount: -commissionAmount,
          referenceType: 'ORDER_SELLER_GROUP',
          referenceId: orderSellerGroupId,
        },
      ],
    });
  }

  /**
   * The offsetting entry for a payout that just reached PAID — negative,
   * equal to -amount, so getBalance's plain SUM(amount) correctly nets
   * down by exactly what was just paid. See SellerPayoutService.adminMarkPaid
   * for why this is the only caller.
   */
  async recordPayout(
    sellerId: string,
    payoutId: string,
    amount: number,
  ): Promise<SellerLedgerEntry> {
    return this.prisma.sellerLedgerEntry.create({
      data: {
        sellerId,
        type: 'PAYOUT',
        amount: -amount,
        referenceType: 'SELLER_PAYOUT',
        referenceId: payoutId,
      },
    });
  }

  /** SUM(amount) over every ledger entry for this seller — the one, only definition of "balance" (see this class's own doc comment). */
  async getBalance(sellerId: string): Promise<number> {
    const result = await this.prisma.sellerLedgerEntry.aggregate({
      where: { sellerId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  async listForSeller(
    sellerId: string,
    pagination: { page: number; pageSize: number },
  ): Promise<{ items: SellerLedgerEntry[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.sellerLedgerEntry.findMany({
        where: { sellerId },
        orderBy: { createdAt: 'desc' },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      this.prisma.sellerLedgerEntry.count({ where: { sellerId } }),
    ]);
    return { items, total };
  }

  /**
   * The one place a ledger entry is created outside a real triggering
   * event — a deliberate, audited, admin-only manual correction (e.g.
   * reversing a data-entry error, a goodwill credit). amount may be
   * positive or negative; there is no floor/ceiling on an adjustment
   * itself, since a real correction could go either direction.
   */
  async adminAdjust(
    adminId: string,
    sellerId: string,
    amount: number,
    note: string,
    ipAddress?: string,
  ): Promise<SellerLedgerEntry> {
    if (amount === 0) {
      throw new BadRequestException('An adjustment of 0 has no effect.');
    }
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found.');

    const entry = await this.prisma.sellerLedgerEntry.create({
      data: { sellerId, type: 'ADJUSTMENT', amount, note },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_LEDGER_ADJUSTMENT',
      resource: 'seller_ledger_entry',
      resourceId: entry.id,
      metadata: { sellerId, amount, note },
      ipAddress,
    });

    return entry;
  }
}
