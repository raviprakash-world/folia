import {
  canCancelOrder,
  canReturnOrder,
  deriveRefundStatus,
} from './refund.util';

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

describe('canReturnOrder', () => {
  const recentOrder = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

  it('allows a return for a delivered order within the 30-day window', () => {
    expect(canReturnOrder('DELIVERED', false, recentOrder)).toBe(true);
  });

  it('rejects a return for anything other than a delivered order', () => {
    expect(canReturnOrder('SHIPPED', false, recentOrder)).toBe(false);
    expect(canReturnOrder('PROCESSING', false, recentOrder)).toBe(false);
  });

  it('rejects a second return request on an order that already has one', () => {
    expect(canReturnOrder('DELIVERED', true, recentOrder)).toBe(false);
  });

  it('rejects a return once the 30-day window has passed', () => {
    const oldOrder = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(canReturnOrder('DELIVERED', false, oldOrder)).toBe(false);
  });

  it('allows a return exactly at the 30-day boundary', () => {
    const boundaryOrder = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000 + 1000,
    );
    expect(canReturnOrder('DELIVERED', false, boundaryOrder)).toBe(true);
  });
});
