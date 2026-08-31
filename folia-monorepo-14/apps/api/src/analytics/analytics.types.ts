export type AnalyticsEventType =
  | 'PRODUCT_VIEW'
  | 'SEARCH'
  | 'CATEGORY_VIEW'
  | 'ADD_TO_CART'
  | 'WISHLIST_ADD'
  | 'CHECKOUT_STARTED'
  | 'ORDER_CREATED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'RECOMMENDATION_CLICK';

export interface LogEventInput {
  type: AnalyticsEventType;
  userId?: string;
  productId?: string;
  orderId?: string;
  metadata?: Record<string, unknown>;
}

export interface DateRange {
  dateFrom?: Date;
  dateTo?: Date;
}
