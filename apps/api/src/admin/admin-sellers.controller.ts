import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SellersService } from '../sellers/sellers.service';
import { AdminSellersQueryDto } from '../sellers/dto/admin-sellers-query.dto';
import { RejectSellerDto } from '../sellers/dto/reject-seller.dto';
import { SellerStatusNoteDto } from '../sellers/dto/seller-status-note.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Marketplace Phase 2 — the admin seller-moderation surface. Deliberately
 * thin: every real decision (the atomic status transition, audit logging,
 * event emission) lives in SellersService itself, matching
 * AdminReturnsController/ReturnsService's own established split exactly.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/sellers')
export class AdminSellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  list(@Query() query: AdminSellersQueryDto) {
    return this.sellersService.adminList(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.sellersService.adminGetDetail(id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sellersService.adminApprove(admin.id, id, req.ip);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectSellerDto,
    @Req() req: Request,
  ) {
    return this.sellersService.adminReject(admin.id, id, dto, req.ip);
  }

  @Post(':id/suspend')
  suspend(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SellerStatusNoteDto,
    @Req() req: Request,
  ) {
    return this.sellersService.adminSuspend(admin.id, id, dto, req.ip);
  }

  @Post(':id/reactivate')
  reactivate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sellersService.adminReactivate(admin.id, id, req.ip);
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SellerStatusNoteDto,
    @Req() req: Request,
  ) {
    return this.sellersService.adminDeactivate(admin.id, id, dto, req.ip);
  }
}
