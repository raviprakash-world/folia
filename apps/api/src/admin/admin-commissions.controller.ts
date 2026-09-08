import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SellerCommissionService } from '../sellers/seller-commission.service';
import { SetCommissionRateDto } from '../sellers/dto/set-commission-rate.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Marketplace Phase 8 — the admin commission-rate surface. Deliberately
 * thin, matching AdminSellersController's own established split: every
 * real decision (versioning, audit logging) lives in
 * SellerCommissionService.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/commissions')
export class AdminCommissionsController {
  constructor(private readonly commissionService: SellerCommissionService) {}

  @Get()
  list() {
    return this.commissionService.adminListEffectiveRates();
  }

  @Post()
  setRate(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: SetCommissionRateDto,
    @Req() req: Request,
  ) {
    return this.commissionService.adminSetRate(
      admin.id,
      dto.sellerId ?? null,
      dto.ratePercent,
      req.ip,
    );
  }
}
