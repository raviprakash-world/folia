import type { DeliveryMethodType } from '@/types/order';

export interface DeliveryOptionBase {
  id: DeliveryMethodType;
  label: string;
  description: string;
  etaDays: string;
  baseCost: number;
}

export const deliveryMethodDefs: DeliveryOptionBase[] = [
  {
    id: 'standard',
    label: 'Standard Delivery',
    description: 'Our default option — reliable, no rush.',
    etaDays: '3–5 business days',
    baseCost: 6.5,
  },
  {
    id: 'express',
    label: 'Express Delivery',
    description: 'Priority handling and faster transit.',
    etaDays: '1–2 business days',
    baseCost: 14,
  },
  {
    id: 'same-day',
    label: 'Same-Day Delivery',
    description: 'Order before 12pm local time for delivery today. Available in select areas only.',
    etaDays: 'Today, by 9pm',
    baseCost: 19,
  },
  {
    id: 'pickup',
    label: 'Store Pickup',
    description: 'Pick up at our Portland studio — ready in 2 hours, no shipping cost.',
    etaDays: 'Ready in 2 hours',
    baseCost: 0,
  },
];
