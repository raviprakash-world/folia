import type { Coupon } from '@/types/cart';

export const coupons: Coupon[] = [
  { code: 'FOLIA10', type: 'percent', value: 10, description: '10% off your order' },
  { code: 'WELCOME5', type: 'fixed', value: 200, description: '₹200 off orders over ₹1,000', minSubtotal: 1000 },
];
