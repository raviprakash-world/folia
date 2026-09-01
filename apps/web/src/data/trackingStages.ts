import type { DeliveryMethodType, TrackingStage } from '@/types/order';

/** Hours from order placement to expected delivery, per delivery method — paces the tracking simulation. */
export function deliveryWindowHours(method: DeliveryMethodType): number {
  switch (method) {
    case 'pickup':
      return 2;
    case 'same-day':
      return 8;
    case 'express':
      return 36;
    case 'standard':
    default:
      return 96;
  }
}

export const trackingStages: { stage: TrackingStage; label: string; description: string }[] = [
  { stage: 'order-placed', label: 'Order Placed', description: 'Your order was received.' },
  { stage: 'payment-confirmed', label: 'Payment Confirmed', description: 'Payment was successfully processed.' },
  { stage: 'packed', label: 'Packed', description: 'Your items were packed and are ready for pickup.' },
  { stage: 'picked-up', label: 'Picked Up', description: 'The courier picked up your package.' },
  { stage: 'shipped', label: 'Shipped', description: 'Your package left the origin facility.' },
  { stage: 'in-transit', label: 'In Transit', description: 'Your package is on its way.' },
  { stage: 'out-for-delivery', label: 'Out For Delivery', description: "It's on the vehicle for today's delivery run." },
  { stage: 'delivered', label: 'Delivered', description: 'Delivered — enjoy!' },
];
