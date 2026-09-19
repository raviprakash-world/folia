import { deliveryCost, FREE_STANDARD_SHIPPING_THRESHOLD } from './order.types';

describe('deliveryCost', () => {
  it('Standard is Rs 79 below the threshold and free at or above it', () => {
    expect(FREE_STANDARD_SHIPPING_THRESHOLD).toBe(999);
    expect(deliveryCost('STANDARD', 998.99)).toBe(79);
    expect(deliveryCost('STANDARD', 999)).toBe(0);
    expect(deliveryCost('STANDARD', 5000)).toBe(0);
  });

  it('Express, Same-day and Pickup ignore the free-shipping threshold', () => {
    expect(deliveryCost('EXPRESS', 5000)).toBe(199);
    expect(deliveryCost('SAME_DAY', 5000)).toBe(299);
    expect(deliveryCost('PICKUP', 100)).toBe(0);
  });
});
