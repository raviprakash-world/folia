import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  @ApiBearerAuth()
  @Post(':id/verify')
  @ApiOperation({
    summary:
      "Confirms a Razorpay Checkout.js success callback — verifies the signature, independently re-fetches the payment from Razorpay (never trusts the callback's own claimed status/amount), and only then marks the order paid.",
  })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verify(id, user.id, dto);
  }

  @ApiBearerAuth()
  @Post(':id/retry')
  @ApiOperation({
    summary:
      "Opens a fresh Razorpay order against an existing, not-yet-captured Payment after a decline or expiry — same reservation, new payment attempt. Keyed by paymentId, not orderId: an unconfirmed payment has no order yet (see PaymentsService's class doc comment).",
  })
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.paymentsService.retry(id, user.id);
  }

  @ApiBearerAuth()
  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const payment = await this.paymentsService.findOwnedOrThrow(id, user.id);
    return {
      id: payment.id,
      status: payment.status,
      method: payment.method,
      amount: Number(payment.amount),
      currency: payment.currency,
    };
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post(':id/refund')
  @ApiOperation({
    summary:
      'Admin-triggered refund against the real gateway. Phase 6 wires cancellation to this same method automatically; this endpoint remains for a manual admin-triggered refund outside that flow.',
  })
  async refund(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: Request,
  ) {
    const result = await this.paymentsService.refund(id, dto);
    // Real money movement, triggered directly by an admin request — every
    // other consequential admin action in this codebase is audited
    // (AdminOrdersController's status/ship endpoints); this was the one
    // exception until Phase 6 closed it.
    await this.auditService.log({
      actorId: admin.id,
      action: 'PAYMENT_REFUND',
      resource: 'payment',
      resourceId: id,
      metadata: { amount: dto.amount, reason: dto.reason, refundId: result.id },
      ipAddress: req.ip,
    });
    return result;
  }

  /**
   * Razorpay calls this directly — no JWT, no user session, which is why
   * this is the one route in this controller marked @Public(). Signature
   * verification (inside handleWebhookEvent) is what actually
   * authenticates the caller; @SkipThrottle() because Razorpay's own
   * retry/delivery cadence is outside this app's control and a webhook's
   * authenticity already comes from its signature, not its request rate.
   */
  @Public()
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Razorpay webhook endpoint. Authoritative source of payment state — see PaymentsService.handleWebhookEvent for why this is not optional even though verify() above also confirms captures.',
  })
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    if (!req.rawBody) {
      // Should be unreachable — main.ts's json() middleware always sets
      // this — but failing loudly here beats silently skipping signature
      // verification if that ever regresses.
      throw new BadRequestException('Raw request body unavailable.');
    }
    if (!signature || !eventId) {
      throw new BadRequestException(
        'Missing Razorpay signature/event headers.',
      );
    }
    return this.paymentsService.handleWebhookEvent(
      req.rawBody.toString('utf8'),
      signature,
      eventId,
    );
  }
}
