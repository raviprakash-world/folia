/**
 * Event names + payload shapes only — no NestJS service/module imports
 * here, so any controller can safely import this file to emit an event
 * without creating a module dependency on AnalyticsModule. This is what
 * actually breaks the circular dependency that direct AnalyticsService
 * injection would create for foundational modules like ProductsModule
 * (which SearchModule and RecommendationsModule both already depend on —
 * ProductsModule directly importing AnalyticsModule, which imports
 * SearchModule, which imports ProductsModule, is a real cycle; emitting
 * a plain event via the global EventEmitter2 instead has no such
 * problem, since nothing here imports anything from '@nestjs/common'
 * providers or any other module).
 */
export const ANALYTICS_EVENTS = {
  PRODUCT_VIEWED: 'analytics.product_viewed',
  ORDER_CREATED: 'analytics.order_created',
} as const;

export interface ProductViewedPayload {
  productId: string;
  userId?: string;
}

export interface OrderCreatedPayload {
  orderId: string;
  userId: string;
  total: number;
}
