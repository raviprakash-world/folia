import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface EffectiveCommissionRate {
  sellerId: string | null;
  ratePercent: number;
  /** True when this seller has no override and the marketplace default was used instead. Always false for the marketplace-default row itself. */
  isMarketplaceDefault: boolean;
}

/**
 * Marketplace Phase 8 — resolves/manages SellerCommission (schema.prisma,
 * seeded Phase 1). Deliberately its own service, not folded into
 * SellersService: PaymentsService needs only resolveEffectiveRate, and
 * giving it a narrow single-purpose dependency (rather than the much wider
 * SellersService) keeps that import honest about what payment confirmation
 * actually touches.
 */
@Injectable()
export class SellerCommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * The seller's own most recent row (by effectiveFrom, not createdAt —
   * a backdated correction is expressed by effectiveFrom, matching this
   * field's own doc comment) if one exists, else the marketplace default's
   * most recent row. Deliberately accepts an optional external transaction
   * client so PaymentsService.confirmAndCreateOrder can resolve the rate
   * inside the same transaction that freezes it onto the OrderItem/
   * OrderSellerGroup rows — see InventoryService.commitReservation's
   * identical externalTx convention.
   *
   * Throws rather than silently defaulting to 0% when no marketplace
   * default has ever been configured: an unconfigured commission is a real
   * setup error, and silently taking a 0% cut from every seller sale is
   * exactly the kind of "fake/placeholder financial behavior" the
   * governing brief prohibits.
   */
  async resolveEffectiveRate(
    sellerId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<EffectiveCommissionRate> {
    const client = externalTx ?? this.prisma;
    const now = new Date();

    const override = await client.sellerCommission.findFirst({
      where: { sellerId, effectiveFrom: { lte: now } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (override) {
      return {
        sellerId,
        ratePercent: Number(override.ratePercent),
        isMarketplaceDefault: false,
      };
    }

    const marketplaceDefault = await client.sellerCommission.findFirst({
      where: { sellerId: null, effectiveFrom: { lte: now } },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!marketplaceDefault) {
      throw new BadRequestException(
        'No marketplace-default commission rate is configured. An admin must set one via POST /admin/commissions before seller orders can be charged commission.',
      );
    }
    return {
      sellerId,
      ratePercent: Number(marketplaceDefault.ratePercent),
      isMarketplaceDefault: true,
    };
  }

  /** Every seller with at least one order group, alongside their currently effective rate — for the admin commission-management screen. Sellers with no override show the marketplace default. */
  async adminListEffectiveRates(): Promise<{
    marketplaceDefault: number | null;
    sellers: Array<{
      sellerId: string;
      displayName: string;
      ratePercent: number;
      isMarketplaceDefault: boolean;
    }>;
  }> {
    const now = new Date();
    const marketplaceDefaultRow = await this.prisma.sellerCommission.findFirst({
      where: { sellerId: null, effectiveFrom: { lte: now } },
      orderBy: { effectiveFrom: 'desc' },
    });

    const sellers = await this.prisma.seller.findMany({
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });

    const rates = await Promise.all(
      sellers.map(async (seller) => {
        const rate = await this.resolveEffectiveRate(seller.id).catch(
          () => null,
        );
        return {
          sellerId: seller.id,
          displayName: seller.displayName,
          ratePercent: rate?.ratePercent ?? 0,
          isMarketplaceDefault: rate?.isMarketplaceDefault ?? true,
        };
      }),
    );

    return {
      marketplaceDefault: marketplaceDefaultRow
        ? Number(marketplaceDefaultRow.ratePercent)
        : null,
      sellers: rates,
    };
  }

  /**
   * Creates a new versioned rate row — never mutates an existing one, per
   * this model's own doc comment (a historical order must stay accurate to
   * what was configured when it was charged). sellerId: null sets the
   * marketplace default; a specific sellerId sets that seller's override.
   */
  async adminSetRate(
    adminId: string,
    sellerId: string | null,
    ratePercent: number,
    ipAddress?: string,
  ): Promise<{ id: string; sellerId: string | null; ratePercent: number }> {
    if (ratePercent < 0 || ratePercent > 100) {
      throw new BadRequestException('ratePercent must be between 0 and 100.');
    }
    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: sellerId },
      });
      if (!seller) {
        throw new BadRequestException(`No seller with id ${sellerId}.`);
      }
    }

    const created = await this.prisma.sellerCommission.create({
      data: { sellerId, ratePercent },
    });

    await this.auditService.log({
      actorId: adminId,
      action: 'SELLER_COMMISSION_RATE_SET',
      resource: 'seller_commission',
      resourceId: created.id,
      metadata: {
        sellerId,
        ratePercent,
        scope: sellerId ? 'seller-override' : 'marketplace-default',
      },
      ipAddress,
    });

    return {
      id: created.id,
      sellerId: created.sellerId,
      ratePercent: Number(created.ratePercent),
    };
  }
}
