import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Seller } from '@prisma/client';
import { SellerLedgerService } from './seller-ledger.service';
import { SellerPayoutService } from './seller-payout.service';
import { RequireSeller } from '../sellers/decorators/require-seller.decorator';
import { CurrentSeller } from '../sellers/decorators/current-seller.decorator';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { toPublicLedgerEntry, toPublicPayout } from './payout.types';

/**
 * Marketplace Phase 9 — the seller-facing "my earnings" surface. Admin
 * moderation (initiate/mark-processing/mark-paid/mark-failed/cancel, manual
 * adjustments) lives in AdminPayoutsController, mirroring how
 * AdminSellersController is kept separate from this codebase's own
 * customer-facing seller endpoints.
 */
@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers/me')
export class SellerEarningsController {
  constructor(
    private readonly ledgerService: SellerLedgerService,
    private readonly payoutService: SellerPayoutService,
  ) {}

  @Get('balance')
  @RequireSeller()
  async balance(@CurrentSeller() seller: Seller) {
    return { balance: await this.ledgerService.getBalance(seller.id) };
  }

  @Get('ledger')
  @RequireSeller()
  async ledger(
    @CurrentSeller() seller: Seller,
    @Query() query: LedgerQueryDto,
  ) {
    const { items, total } = await this.ledgerService.listForSeller(seller.id, {
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      items: items.map(toPublicLedgerEntry),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  @Get('payouts')
  @RequireSeller()
  async payouts(@CurrentSeller() seller: Seller) {
    const payouts = await this.payoutService.listForSeller(seller.id);
    return payouts.map(toPublicPayout);
  }
}
