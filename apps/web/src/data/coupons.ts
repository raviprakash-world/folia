import type { Coupon } from '@/types/cart';

export const coupons: Coupon[] = [
  { code: 'FOLIA10', type: 'percent', value: 10, description: '10% off your order' },
  { code: 'WELCOME5', type: 'fixed', value: 5, description: '₹5 off orders over ₹25', minSubtotal: 25 },
];
