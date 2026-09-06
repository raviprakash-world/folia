import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EMAIL_SERVICE } from './email.interface';
import type { EmailService } from './email.interface';
import {
  orderPlacedEmail,
  orderCancelledEmail,
  orderReturnRequestedEmail,
  orderStatusChangedEmail,
  orderRefundedEmail,
  paymentFailedEmail,
} from './email-templates';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../config/app-config.service';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';
import type { OrderCreatedPayload } from '../analytics/analytics.events';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type {
  OrderCancelledPayload,
  OrderReturnRequestedPayload,
  OrderStatusChangedPayload,
} from '../notifications/notification.events';
import { PAYMENT_EVENTS } from '../payments/payments.events';
import type {
  PaymentFailedPayload,
  PaymentRefundedPayload,
} from '../payments/payments.events';

/**
 * The email half of this codebase's event-driven pattern — same shape as
 * NotificationEventListener, reusing the exact same event hooks rather
 * than adding a second, parallel set of emit calls for the same real
 * occurrences. Deliberately never lets an email failure become a request
 * failure or an unhandled rejection: every handler wraps its send in a
 * try/catch that logs and returns, since a down/unconfigured email
 * provider must never break checkout, cancellation, or anything else
 * upstream of the event that triggered it. This is also why sends happen
 * inline rather than through a BullMQ queue (unlike this codebase's
 * scheduled jobs) — a queued retry would be a genuine improvement, not
 * yet built; see docs/API_INTEGRATION_STATUS.md for that stated scope cut.
 */
@Injectable()
export class EmailEventListener {
  private readonly logger = new Logger(EmailEventListener.name);

  constructor(
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly config: AppConfigService,
  ) {}

  private orderUrl(orderId: string): string {
    return `${this.config.frontendUrl}/account/orders/${orderId}`;
  }

  private async sendTo(
    userId: string,
    build: (email: string) => { subject: string; html: string; text: string },
    context: string,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(userId);
      if (!user) return; // deleted/unknown user — nothing to email, not an error worth logging
      const { subject, html, text } = build(user.email);
      await this.emailService.send({ to: user.email, subject, html, text });
    } catch (err) {
      this.logger.warn(
        `Could not send ${context} email to user ${userId}: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(ANALYTICS_EVENTS.ORDER_CREATED)
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    await this.sendTo(
      payload.userId,
      () => orderPlacedEmail(payload.orderId, this.orderUrl(payload.orderId)),
      'order-placed',
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED)
  async handleOrderCancelled(payload: OrderCancelledPayload): Promise<void> {
    await this.sendTo(
      payload.userId,
      () =>
        orderCancelledEmail(payload.orderId, this.orderUrl(payload.orderId)),
      'order-cancelled',
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_RETURN_REQUESTED)
  async handleOrderReturnRequested(
    payload: OrderReturnRequestedPayload,
  ): Promise<void> {
    await this.sendTo(
      payload.userId,
      () =>
        orderReturnRequestedEmail(
          payload.orderId,
          this.orderUrl(payload.orderId),
        ),
      'return-requested',
    );
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED)
  async handleOrderStatusChanged(
    payload: OrderStatusChangedPayload,
  ): Promise<void> {
    await this.sendTo(
      payload.userId,
      () =>
        orderStatusChangedEmail(
          payload.orderId,
          payload.status,
          this.orderUrl(payload.orderId),
        ),
      'order-status-changed',
    );
  }

  @OnEvent(PAYMENT_EVENTS.REFUNDED)
  async handlePaymentRefunded(payload: PaymentRefundedPayload): Promise<void> {
    if (!payload.orderId) {
      // Never actually reachable today (see PaymentRefundedPayload's own
      // doc comment) — logged rather than silently skipped so a future
      // real occurrence isn't invisible.
      this.logger.warn(
        `PAYMENT_EVENTS.REFUNDED fired with no orderId for payment ${payload.paymentId} — skipping the refund email, nothing sensible to link to.`,
      );
      return;
    }
    await this.sendTo(
      payload.userId,
      () =>
        orderRefundedEmail(
          payload.orderId!,
          payload.amount,
          this.orderUrl(payload.orderId!),
        ),
      'order-refunded',
    );
  }

  @OnEvent(PAYMENT_EVENTS.FAILED)
  async handlePaymentFailed(payload: PaymentFailedPayload): Promise<void> {
    // No orderId (Phase 2: a failed/declined attempt never produced an
    // order) — the cart page is the honest destination, not a
    // payment-specific retry link, since retrying happens through this
    // app's own client-side checkout state, not a URL any deep link could
    // reconstruct.
    await this.sendTo(
      payload.userId,
      () =>
        paymentFailedEmail(
          `${this.config.frontendUrl}/cart`,
          payload.errorDescription,
        ),
      'payment-failed',
    );
  }
}
