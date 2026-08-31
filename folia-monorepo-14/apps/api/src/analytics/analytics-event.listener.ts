import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AnalyticsService } from './analytics.service';
import { ANALYTICS_EVENTS } from './analytics.events';
import type {
  OrderCreatedPayload,
  ProductViewedPayload,
} from './analytics.events';

/**
 * The listening half of the event-driven analytics pattern (see
 * analytics.events.ts's doc comment for why this exists instead of
 * direct service injection from every emitting controller). Lives in
 * AnalyticsModule, which is the only module that needs to know
 * AnalyticsService exists at all for this purpose.
 */
@Injectable()
export class AnalyticsEventListener {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @OnEvent(ANALYTICS_EVENTS.PRODUCT_VIEWED)
  async handleProductViewed(payload: ProductViewedPayload): Promise<void> {
    await this.analyticsService.log({
      type: 'PRODUCT_VIEW',
      productId: payload.productId,
      userId: payload.userId,
    });
  }

  @OnEvent(ANALYTICS_EVENTS.ORDER_CREATED)
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    await this.analyticsService.log({
      type: 'ORDER_CREATED',
      orderId: payload.orderId,
      userId: payload.userId,
      metadata: { total: payload.total },
    });
  }
}
