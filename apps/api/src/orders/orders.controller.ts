import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrdersService } from './orders.service';
import { ReturnsService } from './returns.service';
import { CheckoutDto } from './dto/checkout.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { CreateReturnClaimDto } from './dto/create-return-claim.dto';
import { UpdateNotesDto } from './dto/update-notes.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import {
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_FILE_BYTES,
} from './evidence-file.util';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly returnsService: ReturnsService,
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

  /**
   * Phase 6D-3 — replaces the old whole-order, always-auto-approved
   * `POST orders/:id/return` (removed, not deprecated: it had no
   * plant-vs-non-plant awareness at all, so leaving it live would let a
   * customer trivially bypass the newly locked "no ordinary plant
   * change-of-mind returns" rule right next to the endpoint that enforces
   * it — see docs/PHASE_6D_MIGRATION_DESIGN.md for the full reasoning).
   * multipart/form-data: `items` arrives as a JSON-encoded string field
   * (see CreateReturnClaimDto), evidence as 0+ files under the `evidence`
   * field name. A newly created claim always starts PENDING — no refund,
   * store credit, replacement order, or Order.status change happens here;
   * that's the admin-resolution phase (Phase 6D-4+).
   */
  @Post('orders/:id/returns')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FilesInterceptor('evidence', MAX_EVIDENCE_FILES, {
      limits: { fileSize: MAX_EVIDENCE_FILE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Only allowed for delivered orders with no existing claim. Claim type (standard return vs. plant DOA/damage) is derived server-side from the selected items — never accepted from the client.',
  })
  async createReturnClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReturnClaimDto,
    @UploadedFiles() evidence: Express.Multer.File[],
  ) {
    return this.returnsService.createClaim(user.id, id, dto, evidence ?? []);
  }

  /**
   * Phase 6D-4H — the caller's own return/DOA claim for this order, if
   * any. Same underlying record the admin view uses, minus admin-only
   * fields (see ReturnsService.getMyClaim). 404 both when no claim exists
   * for this order and when the order itself isn't the caller's own —
   * ownership is enforced by the query itself, never revealed via a
   * different error for "wrong owner" vs "doesn't exist".
   */
  @Get('orders/:id/returns')
  @ApiOperation({
    summary:
      "The caller's own return/DOA claim for this order, if any — same shape the admin view uses, minus admin-only fields.",
  })
  async getMyReturnClaim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.returnsService.getMyClaim(user.id, id);
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
