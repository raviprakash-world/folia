import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SellerProductsService } from '../sellers/seller-products.service';
import { AdminSellerProductsQueryDto } from '../sellers/dto/admin-seller-products-query.dto';
import { RejectSellerProductDto } from '../sellers/dto/reject-seller-product.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

/**
 * Marketplace Phase 3 — the admin seller-product moderation surface.
 * Deliberately separate from AdminProductsController (Folia's own
 * catalog CRUD, unchanged) — every method here is scoped to
 * ownerType: 'SELLER_OWNED' inside SellerProductsService, so this
 * endpoint can never touch a Folia-owned product.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/seller-products')
export class AdminSellerProductsController {
  constructor(private readonly sellerProductsService: SellerProductsService) {}

  @Get()
  list(@Query() query: AdminSellerProductsQueryDto) {
    return this.sellerProductsService.adminList(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.sellerProductsService.adminGetDetail(id);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sellerProductsService.adminApprove(admin.id, id, req.ip);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectSellerProductDto,
    @Req() req: Request,
  ) {
    return this.sellerProductsService.adminReject(admin.id, id, dto, req.ip);
  }

  @Post(':id/request-changes')
  requestChanges(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectSellerProductDto,
    @Req() req: Request,
  ) {
    return this.sellerProductsService.adminRequestChanges(
      admin.id,
      id,
      dto,
      req.ip,
    );
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.sellerProductsService.adminDeactivate(admin.id, id, req.ip);
  }
}
