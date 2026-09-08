import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { SellerPayout, SellerPayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SellerLedgerService } from './seller-ledger.service';
import { generateSecureToken } from '../auth/token.util';
import {
  NOTIFICATION_EVENTS,
  type SellerPayoutPaidPayload,
} from '../notifications/notification.events';

/**
 * Marketplace Phase 9 — the real, explicit payout lifecycle
 * (PENDING/PROCESSING/PAID/FAILED/CANCELLED, schema-forward-declared in
 * Phase 1). Real bank-to-seller money movement is credential-blocked: no
 * payout provider (RazorpayX/Route, per this initiative's own Phase 0
 * decision) is configured in this environment, so PAID is reachable only
 * via an explicit admin confirmation that a real transfer was completed
 * OUTSIDE this system — never a timer, never automatic. See
 * docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §9 and this phase's
 * own gate report for the honest statement of what remains blocked.
 */
@Injectable()
export class SellerPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ledgerService: SellerLedgerService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Claims every ledger entry not yet claimed by an earlier payout (any
   * type except PAYOUT itself — a PAYOUT entry is an outcome, never an
   * input) into a new PENDING SellerPayout. The claim is what
   * SellerPayoutItem.ledgerEntryId's own @unique constraint enforces at
   * the database level: if a concurrent call already claimed one of these
   * same entries, this createMany fails and the whole transaction rolls
   * back cleanly — no partial claim, no double-claim, nothing to manually
   * reconcile. Rejects up front if there is nothing unclaimed to pay out.
   */
  async adminInitiatePayout(
    adminId: string,
    sellerId: string,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
    });
    if (!seller) throw new NotFoundException('Seller not found.');

    let payout: SellerPayout;
    try {
      payout = await this.prisma.$transaction(async (tx) => {
        const claimable = await tx.sellerLedgerEntry.findMany({
          where: { sellerId, type: { not: 'PAYOUT' }, payoutItem: null },
        });
        const amount = claimable.reduce(
          (sum, entry) => sum + Number(entry.amount),
          0,
        );
        if (amount <= 0) {
          throw new BadRequestException(
            amount === 0
              ? 'This seller has no unclaimed balance to pay out.'
              : 'This seller currently has a negative unclaimed balance — nothing payable.',
          );
        }

        const created = await tx.sellerPayout.create({
          data: {
            sellerId,
            status: 'PENDING',
            amount,
            idempotencyKey: idempotencyKey ?? generateSecureToken().raw,
          },
        });

        await tx.sellerPayoutItem.createMany({
          data: claimable.map((entry) => ({
            payoutId: created.id,
            ledgerEntryId: entry.id,
          })),
        });

        return created;
      });
    } catch (err) {
      // The narrow window this guards: two adminInitiatePayout calls for
      // the same seller whose transactions' reads truly interleaved (both
      // saw the same unclaimed entries before either committed) — rare for
      // an admin-only, low-frequency action, but a real possibility this
      // codebase's own established convention (see SellersService.apply's
      // identical P2002 handling) surfaces as a clear 409, not a raw 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Another payout for this seller was just initiated and already claimed this balance. Please try again.',
        );
      }
      throw err;
    }

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_PAYOUT_INITIATED',
      resource: 'seller_payout',
      resourceId: payout.id,
      metadata: { sellerId, amount: Number(payout.amount) },
      ipAddress,
    });

    return payout;
  }

  /** PENDING -> PROCESSING: an admin has started the real transfer outside this system. */
  async adminMarkProcessing(
    adminId: string,
    payoutId: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    return this.transitionStatus(
      adminId,
      payoutId,
      ['PENDING'],
      { status: 'PROCESSING' },
      'SELLER_PAYOUT_PROCESSING',
      ipAddress,
    );
  }

  /**
   * PROCESSING -> PAID: an explicit admin confirmation that the real
   * transfer actually succeeded. Writes the offsetting PAYOUT ledger entry
   * (negative, equal to -amount) so SellerLedgerService.getBalance's plain
   * SUM(amount) correctly nets down by exactly what was just paid —
   * without this, the SALE/COMMISSION entries this payout claimed would
   * stay in the ledger forever (correctly, for audit history) but leave
   * the running balance overstated.
   */
  async adminMarkPaid(
    adminId: string,
    payoutId: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    const payout = await this.transitionStatus(
      adminId,
      payoutId,
      ['PROCESSING'],
      { status: 'PAID', processedAt: new Date() },
      'SELLER_PAYOUT_PAID',
      ipAddress,
    );

    await this.ledgerService.recordPayout(
      payout.sellerId,
      payout.id,
      Number(payout.amount),
    );

    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: payout.sellerId },
    });
    const payload: SellerPayoutPaidPayload = {
      sellerId: payout.sellerId,
      userId: seller.userId,
      payoutId: payout.id,
      amount: Number(payout.amount),
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.SELLER_PAYOUT_PAID, payload);

    return payout;
  }

  /**
   * (PENDING|PROCESSING) -> FAILED: releases every ledger entry this
   * payout had claimed (deletes its SellerPayoutItem rows, not the ledger
   * entries themselves) so they become claimable again by a future payout
   * attempt — a failed transfer must not leave real, earned proceeds
   * permanently stuck unclaimed.
   */
  async adminMarkFailed(
    adminId: string,
    payoutId: string,
    failureReason: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    return this.releaseAndTransition(
      adminId,
      payoutId,
      ['PENDING', 'PROCESSING'],
      { status: 'FAILED', failureReason },
      'SELLER_PAYOUT_FAILED',
      ipAddress,
    );
  }

  /** (PENDING|PROCESSING) -> CANCELLED: an admin decided not to pay (e.g. a dispute) rather than a failed transfer attempt — same claim-release as adminMarkFailed, distinct audit action so the two are never confused in the trail. */
  async adminCancel(
    adminId: string,
    payoutId: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    return this.releaseAndTransition(
      adminId,
      payoutId,
      ['PENDING', 'PROCESSING'],
      { status: 'CANCELLED' },
      'SELLER_PAYOUT_CANCELLED',
      ipAddress,
    );
  }

  async listForSeller(sellerId: string): Promise<SellerPayout[]> {
    return this.prisma.sellerPayout.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminGetDetail(payoutId: string) {
    const payout = await this.prisma.sellerPayout.findUnique({
      where: { id: payoutId },
      include: { items: { include: { ledgerEntry: true } } },
    });
    if (!payout) throw new NotFoundException('Payout not found.');
    return payout;
  }

  async adminListAll(filter: {
    sellerId?: string;
    status?: SellerPayoutStatus;
  }): Promise<SellerPayout[]> {
    return this.prisma.sellerPayout.findMany({
      where: { sellerId: filter.sellerId, status: filter.status },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Same atomic-conditional-update idiom this whole marketplace initiative uses for every state transition — see e.g. SellersService.transitionStatus. Uses ConflictException (409) for a bad transition, matching that method's own convention. */
  private async transitionStatus(
    adminId: string,
    payoutId: string,
    fromStatuses: SellerPayoutStatus[],
    data: Prisma.SellerPayoutUpdateManyMutationInput,
    auditAction: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    const { count } = await this.prisma.sellerPayout.updateMany({
      where: { id: payoutId, status: { in: fromStatuses } },
      data,
    });
    if (count === 0) {
      const existing = await this.prisma.sellerPayout.findUnique({
        where: { id: payoutId },
      });
      if (!existing) throw new NotFoundException('Payout not found.');
      throw new ConflictException(
        `Payout is currently ${existing.status} and cannot make this transition.`,
      );
    }

    const updated = await this.prisma.sellerPayout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    await this.auditService.log({
      actorId: adminId,
      action: auditAction,
      resource: 'seller_payout',
      resourceId: payoutId,
      metadata: { sellerId: updated.sellerId, amount: Number(updated.amount) },
      ipAddress,
    });
    return updated;
  }

  private async releaseAndTransition(
    adminId: string,
    payoutId: string,
    fromStatuses: SellerPayoutStatus[],
    data: Prisma.SellerPayoutUpdateManyMutationInput,
    auditAction: string,
    ipAddress?: string,
  ): Promise<SellerPayout> {
    const updated = await this.transitionStatus(
      adminId,
      payoutId,
      fromStatuses,
      data,
      auditAction,
      ipAddress,
    );
    await this.prisma.sellerPayoutItem.deleteMany({
      where: { payoutId: updated.id },
    });
    return updated;
  }
}
