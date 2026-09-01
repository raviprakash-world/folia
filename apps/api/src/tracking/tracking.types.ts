export type TrackingStage =
  | 'ORDER_PLACED'
  | 'PAYMENT_CONFIRMED'
  | 'PACKED'
  | 'PICKED_UP'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED';

/** Matches apps/web/src/data/trackingStages.ts's trackingStages exactly. */
export const TRACKING_STAGE_DEFS: {
  stage: TrackingStage;
  label: string;
  description: string;
}[] = [
  {
    stage: 'ORDER_PLACED',
    label: 'Order Placed',
    description: 'Your order was received.',
  },
  {
    stage: 'PAYMENT_CONFIRMED',
    label: 'Payment Confirmed',
    description: 'Payment was successfully processed.',
  },
  {
    stage: 'PACKED',
    label: 'Packed',
    description: 'Your items were packed and are ready for pickup.',
  },
  {
    stage: 'PICKED_UP',
    label: 'Picked Up',
    description: 'The courier picked up your package.',
  },
  {
    stage: 'SHIPPED',
    label: 'Shipped',
    description: 'Your package left the origin facility.',
  },
  {
    stage: 'IN_TRANSIT',
    label: 'In Transit',
    description: 'Your package is on its way.',
  },
  {
    stage: 'OUT_FOR_DELIVERY',
    label: 'Out For Delivery',
    description: "It's on the vehicle for today's delivery run.",
  },
  { stage: 'DELIVERED', label: 'Delivered', description: 'Delivered — enjoy!' },
];

const stageToPublic: Record<TrackingStage, string> = {
  ORDER_PLACED: 'order-placed',
  PAYMENT_CONFIRMED: 'payment-confirmed',
  PACKED: 'packed',
  PICKED_UP: 'picked-up',
  SHIPPED: 'shipped',
  IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'out-for-delivery',
  DELIVERED: 'delivered',
};
export function stagePublicName(stage: TrackingStage): string {
  return stageToPublic[stage];
}

/** Matches apps/web/src/data/trackingStages.ts's deliveryWindowHours exactly. */
export function deliveryWindowHours(
  method: 'STANDARD' | 'EXPRESS' | 'SAME_DAY' | 'PICKUP',
): number {
  switch (method) {
    case 'PICKUP':
      return 2;
    case 'SAME_DAY':
      return 8;
    case 'EXPRESS':
      return 36;
    case 'STANDARD':
    default:
      return 96;
  }
}
