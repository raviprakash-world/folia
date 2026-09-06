import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ReturnOrderDto } from './dto/return-order.dto';
import { UpdateNotesDto } from './dto/update-notes.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
  /**
   * No ANALYTICS_EVENTS.ORDER_CREATED emission here (Phase 1 had one,
   * unconditionally, right after this call): Phase 2 only ever creates an
   * Order once payment is confirmed, which for a gateway method hasn't
   * happened yet by the time this returns — see
   * PaymentsService.confirmAndCreateOrder, the one place an Order row is
   * actually created (whether via COD's immediate synchronous path, a
   * client verify() callback, or the authoritative webhook), which is
   * where that event is emitted now so it fires exactly once per real
   * order regardless of which of those three paths produced it.
   */
  async checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey?: string,
  ) {
    return this.ordersService.checkout(user.id, dto, idempotencyKey);
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

  @Patch('orders/:id/notes')
  updateNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateNotesDto,
  ) {
    return this.ordersService.updateNotes(user.id, id, dto.notes);
  }

  @Post('orders/:id/reorder')
  @ApiOperation({
    summary:
      'Adds items from a past order back into the current cart, checking real current availability for each — skips anything now unavailable rather than failing the whole request.',
  })
  reorder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.reorder(user.id, id);
  }
}
