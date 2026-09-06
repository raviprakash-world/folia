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
   * PUT :id/status accepts.
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
}
