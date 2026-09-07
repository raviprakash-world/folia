import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SellerLedgerService } from '../payouts/seller-ledger.service';
import { SellerPayoutService } from '../payouts/seller-payout.service';
import { AdjustLedgerDto } from '../payouts/dto/adjust-ledger.dto';
import { FailPayoutDto } from '../payouts/dto/fail-payout.dto';
import { LedgerQueryDto } from '../payouts/dto/ledger-query.dto';
import { AdminPayoutsQueryDto } from '../payouts/dto/admin-payouts-query.dto';
import { toPublicLedgerEntry, toPublicPayout } from '../payouts/payout.types';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Marketplace Phase 9 — the admin ledger/payout surface. Deliberately
 * thin, matching AdminSellersController/AdminCommissionsController's own
 * established split: every real decision (versioning, claiming, audit
 * logging) lives in SellerLedgerService/SellerPayoutService.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin')
export class AdminPayoutsController {
  constructor(
    private readonly ledgerService: SellerLedgerService,
    private readonly payoutService: SellerPayoutService,
  ) {}

  @Get('sellers/:id/balance')
  async balance(@Param('id') sellerId: string) {
    return { balance: await this.ledgerService.getBalance(sellerId) };
  }

  @Get('sellers/:id/ledger')
  async ledger(@Param('id') sellerId: string, @Query() query: LedgerQueryDto) {
    const { items, total } = await this.ledgerService.listForSeller(sellerId, {
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

  @Post('sellers/:id/ledger-adjustments')
  async adjustLedger(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') sellerId: string,
    @Body() dto: AdjustLedgerDto,
    @Req() req: Request,
  ) {
    const entry = await this.ledgerService.adminAdjust(
      admin.id,
      sellerId,
      dto.amount,
      dto.note,
      req.ip,
    );
    return toPublicLedgerEntry(entry);
  }

  @Post('sellers/:id/payouts')
  async initiatePayout(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') sellerId: string,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
    @Req() req: Request,
  ) {
    const payout = await this.payoutService.adminInitiatePayout(
      admin.id,
      sellerId,
      idempotencyKey,
      req.ip,
    );
    return toPublicPayout(payout);
  }

  @Get('payouts')
  async listPayouts(@Query() query: AdminPayoutsQueryDto) {
    const payouts = await this.payoutService.adminListAll({
      sellerId: query.sellerId,
      status: query.status,
    });
    return payouts.map(toPublicPayout);
  }

  @Get('payouts/:id')
  async payoutDetail(@Param('id') id: string) {
    return this.payoutService.adminGetDetail(id);
  }

  @Post('payouts/:id/mark-processing')
  async markProcessing(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const payout = await this.payoutService.adminMarkProcessing(
      admin.id,
      id,
      req.ip,
    );
    return toPublicPayout(payout);
  }

  @Post('payouts/:id/mark-paid')
  async markPaid(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const payout = await this.payoutService.adminMarkPaid(admin.id, id, req.ip);
    return toPublicPayout(payout);
  }

  @Post('payouts/:id/mark-failed')
  async markFailed(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: FailPayoutDto,
    @Req() req: Request,
  ) {
    const payout = await this.payoutService.adminMarkFailed(
      admin.id,
      id,
      dto.failureReason,
      req.ip,
    );
    return toPublicPayout(payout);
  }

  @Post('payouts/:id/cancel')
  async cancel(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const payout = await this.payoutService.adminCancel(admin.id, id, req.ip);
    return toPublicPayout(payout);
  }
}
