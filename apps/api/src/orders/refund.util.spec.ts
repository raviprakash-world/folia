import { canCancelOrder, deriveRefundStatus } from './refund.util';

describe('deriveRefundStatus', () => {
  it('reports processing immediately after the request', () => {
    expect(deriveRefundStatus(new Date())).toBe('processing');
  });

  it('reports refunded once the 3-minute window has elapsed', () => {
    const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000);
    expect(deriveRefundStatus(fourMinutesAgo)).toBe('refunded');
  });

  it('reports processing right up to just under the 3-minute boundary', () => {
    const almostThreeMinutesAgo = new Date(Date.now() - (3 * 60 * 1000 - 1000));
    expect(deriveRefundStatus(almostThreeMinutesAgo)).toBe('processing');
  });
});

describe('canCancelOrder', () => {
  it('allows cancellation for processing, confirmed, and shipped orders', () => {
    expect(canCancelOrder('PROCESSING', false)).toBe(true);
    expect(canCancelOrder('CONFIRMED', false)).toBe(true);
    expect(canCancelOrder('SHIPPED', false)).toBe(true);
  });

  it('rejects cancellation for delivered, cancelled, returned, or refunded orders', () => {
    expect(canCancelOrder('DELIVERED', false)).toBe(false);
    expect(canCancelOrder('CANCELLED', false)).toBe(false);
    expect(canCancelOrder('RETURNED', false)).toBe(false);
    expect(canCancelOrder('REFUNDED', false)).toBe(false);
  });

  it('rejects a second cancellation on an order that already has one, even if the status would otherwise allow it', () => {
    expect(canCancelOrder('SHIPPED', true)).toBe(false);
  });
});
