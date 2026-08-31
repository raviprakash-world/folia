import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post('checkout')
  @ApiOperation({
    summary:
      "Submits the caller's current cart as a real order — computes tax/discount/total, processes payment, decrements inventory, clears the cart.",
  })
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    const order = await this.ordersService.checkout(
      user.id,
      dto,
      idempotencyKey,
    );

    if (!order.isIdempotentReplay) {
      // Known eventemitter2 package type-resolution quirk (tsc has zero
      // complaints here) — see products.controller.ts's findBySlug for the
      // full explanation, not repeated at every call site.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      this.eventEmitter.emit(ANALYTICS_EVENTS.ORDER_CREATED, {
        orderId: order.id,
        userId: user.id,
        total: order.total,
      });
    }
    return order;
  }

  @Get('orders')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.findAllForUser(user.id);
  }

  @Get('orders/:id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOneForUser(user.id, id);
  }

  @Post('orders/:id/cancel')
  @ApiOperation({
    summary:
      'Only allowed while processing/confirmed/shipped and not already cancelled.',
  })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    const result = await this.ordersService.requestCancellation(
      user.id,
      id,
      dto,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.ORDER_CANCELLED, {
      orderId: id,
      userId: user.id,
    });
    return result;
  }

  @Post('orders/:id/return')
  @ApiOperation({
    summary:
      'Only allowed for delivered orders within 30 days, with no existing return request.',
  })
  async requestReturn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReturnOrderDto,
  ) {
    const result = await this.ordersService.requestReturn(user.id, id, dto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.ORDER_RETURN_REQUESTED, {
      orderId: id,
      userId: user.id,
    });
    return result;
  }

  @Get('orders/:id/tracking')
  @ApiOperation({
    summary:
      'Deterministic, simulated real-time tracking — recomputed fresh on every read, nothing here is stored.',
  })
  getTracking(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.getTracking(user.id, id);
  }
}
