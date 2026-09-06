import { canTransitionStatus } from './order-status.util';

describe('canTransitionStatus', () => {
  it('allows the real forward fulfillment progression this generic endpoint still owns', () => {
    expect(canTransitionStatus('PROCESSING', 'CONFIRMED')).toBe(true);
    expect(canTransitionStatus('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('rejects CONFIRMED -> SHIPPED through this generic endpoint (Phase 5): that step now requires the dedicated ship action, which actually creates a real shipment first', () => {
    expect(canTransitionStatus('CONFIRMED', 'SHIPPED')).toBe(false);
  });

  it('rejects skipping a stage', () => {
    expect(canTransitionStatus('PROCESSING', 'SHIPPED')).toBe(false);
    expect(canTransitionStatus('PROCESSING', 'DELIVERED')).toBe(false);
  });

  it('rejects moving backward', () => {
    expect(canTransitionStatus('SHIPPED', 'PROCESSING')).toBe(false);
    expect(canTransitionStatus('DELIVERED', 'CONFIRMED')).toBe(false);
  });

  it('rejects any transition out of DELIVERED — a terminal state for this admin flow', () => {
    expect(canTransitionStatus('DELIVERED', 'PROCESSING')).toBe(false);
    expect(canTransitionStatus('DELIVERED', 'SHIPPED')).toBe(false);
  });

  it('never allows CANCELLED/RETURNED/REFUNDED through this generic transition check, regardless of starting status — those have their own dedicated endpoints', () => {
    for (const from of ['PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED']) {
      expect(canTransitionStatus(from, 'CANCELLED')).toBe(false);
      expect(canTransitionStatus(from, 'RETURNED')).toBe(false);
      expect(canTransitionStatus(from, 'REFUNDED')).toBe(false);
    }
  });

  it('rejects a transition from an already-terminal state like CANCELLED', () => {
    expect(canTransitionStatus('CANCELLED', 'CONFIRMED')).toBe(false);
  });
});
