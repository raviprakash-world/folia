import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrdersService } from '../orders/orders.service';
import { AuditService } from '../audit/audit.service';
import { AdminOrderStatusDto } from './dto/admin-order-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.ordersService.adminFindAll({ status });
  }

  @Put(':id/status')
  async updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminOrderStatusDto,
    @Req() req: Request,
  ) {
    const order = await this.ordersService.adminUpdateStatus(id, dto.status);
    await this.auditService.log({
      actorId: admin.id,
      action: 'ORDER_STATUS_UPDATE',
      resource: 'order',
      resourceId: id,
      metadata: { newStatus: dto.status },
      ipAddress: req.ip,
    });
    return order;
  }

  /**
   * Real fulfillment (Phase 5) — creates an actual shipment via the
   * configured courier provider (see ShippingProviderClient) and only
   * then moves the order to SHIPPED. See order-status.util.ts's doc
   * comment for why this is a dedicated endpoint rather than a value
   * PUT :id/status accepts. Marketplace Phase 12 — refuses a genuine
   * multi-seller order now; use POST :id/order-groups/:groupId/ship for
   * each seller's own portion instead.
   */
  @Post(':id/ship')
  async ship(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const order = await this.ordersService.shipOrder(id);
    await this.auditService.log({
      actorId: admin.id,
      action: 'ORDER_SHIP',
      resource: 'order',
      resourceId: id,
      metadata: {
        courierId: order.courierId,
        trackingNumber: order.trackingNumber,
      },
      ipAddress: req.ip,
    });
    return order;
  }

  /**
   * Marketplace Phase 12 — admin can ship any seller's own group,
   * including Folia's own (sellerId: null), which has no seller account
   * to self-serve it. See SellerFulfillmentController for the
   * seller-facing equivalent, scoped to their own groups only.
   */
  @Post('groups/:groupId/ship')
  async shipGroup(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Req() req: Request,
  ) {
    const group = await this.ordersService.shipOrderSellerGroup(groupId);
    await this.auditService.log({
      actorId: admin.id,
      action: 'ORDER_GROUP_SHIP',
      resource: 'order_seller_group',
      resourceId: groupId,
      metadata: {
        courierId: group.courierId,
        trackingNumber: group.trackingNumber,
      },
      ipAddress: req.ip,
    });
    return group;
  }

  /**
   * Marketplace Phase 12 — no real delivery webhook exists (same honesty
   * posture as the whole-order Order.deliveredAt field), so this stays an
   * explicit admin action, never automatic.
   */
  @Post('groups/:groupId/mark-delivered')
  async markGroupDelivered(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Req() req: Request,
  ) {
    const group = await this.ordersService.markGroupDelivered(groupId);
    await this.auditService.log({
      actorId: admin.id,
      action: 'ORDER_GROUP_DELIVERED',
      resource: 'order_seller_group',
      resourceId: groupId,
      ipAddress: req.ip,
    });
    return group;
  }
}
