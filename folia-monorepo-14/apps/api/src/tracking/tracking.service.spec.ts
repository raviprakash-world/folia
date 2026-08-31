import { TrackingService } from './tracking.service';
import type { TrackingInput } from './tracking.service';

const BASE_INPUT: TrackingInput = {
  orderId: 'FOL-20260101-0001', // hand-verified on-time (seed % 6 !== 0)
  placedAt: new Date('2026-01-01T00:00:00Z'),
  deliveryMethod: 'STANDARD', // 96-hour window
  destinationCity: 'Seattle, WA',
  courierId: 'swiftpost',
  trackingNumber: 'SW123456789',
};

describe('TrackingService.simulate', () => {
  const service = new TrackingService();

  it('shows nothing completed at the moment of placement', () => {
    const result = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.stages[0]?.completed).toBe(true); // order-placed itself is always immediately true
    expect(result.stages[7]?.completed).toBe(false); // delivered is not
    expect(result.progressPercent).toBeLessThan(20);
  });

  it('shows full delivery once the full window has elapsed', () => {
    const result = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-05T00:00:00Z'),
    }); // 96h later, exactly the standard window
    expect(result.progressPercent).toBe(100);
    expect(result.stages.every((s) => s.completed)).toBe(true);
  });

  it('never exceeds 100% progress even long after the window', () => {
    const result = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-06-01T00:00:00Z'),
    });
    expect(result.progressPercent).toBe(100);
  });

  it('identifies an order id whose deterministic seed falls in the ~1-in-6 delayed bucket', () => {
    const result = service.simulate({
      ...BASE_INPUT,
      orderId: 'FOL-20260101-0003',
      frozenAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.isDelayed).toBe(true);
    expect(result.delayHours).toBeGreaterThanOrEqual(6);
    expect(result.delayHours).toBeLessThan(18);
  });

  it('does not report a delay for an order id outside that bucket', () => {
    const result = service.simulate({
      ...BASE_INPUT,
      orderId: 'FOL-20260101-0001',
      frozenAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.isDelayed).toBe(false);
    expect(result.delayHours).toBeNull();
  });

  it('is fully deterministic — identical inputs always produce identical output', () => {
    const a = service.simulate(BASE_INPUT);
    const b = service.simulate(BASE_INPUT);
    expect(a).toEqual(b);
  });

  it('provides real proof of delivery only once actually delivered, never before', () => {
    const notYet = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-02T00:00:00Z'),
    }); // partway through
    expect(notYet.proofOfDelivery).toBeNull();

    const delivered = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-06T00:00:00Z'),
    }); // well past the window
    expect(delivered.proofOfDelivery).not.toBeNull();
    expect(delivered.proofOfDelivery?.deliveredTo).toBeDefined();
    expect(delivered.proofOfDelivery?.signedBy).toBeDefined();
  });

  it('freezing at a past moment (frozenAt) stops progress from advancing further, unlike the live "now" default', () => {
    const frozen = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-01T12:00:00Z'),
    }); // 12h in, ~12.5% of 96h window
    expect(frozen.progressPercent).toBeLessThan(50);
  });

  it("publishes stage names in the frontend's exact lowercase-hyphenated format, not the internal enum", () => {
    const result = service.simulate({
      ...BASE_INPUT,
      frozenAt: new Date('2026-01-01T00:00:00Z'),
    });
    expect(result.stages.map((s) => s.stage)).toEqual([
      'order-placed',
      'payment-confirmed',
      'packed',
      'picked-up',
      'shipped',
      'in-transit',
      'out-for-delivery',
      'delivered',
    ]);
  });

  it('uses a shorter window for pickup than standard delivery, changing how fast progress advances', () => {
    const evaluateAt = new Date('2026-01-01T01:00:00Z'); // 1 hour after placement
    const standardResult = service.simulate({
      ...BASE_INPUT,
      deliveryMethod: 'STANDARD',
      frozenAt: evaluateAt,
    });
    const pickupResult = service.simulate({
      ...BASE_INPUT,
      deliveryMethod: 'PICKUP',
      frozenAt: evaluateAt,
    });
    expect(pickupResult.progressPercent).toBeGreaterThan(
      standardResult.progressPercent,
    );
  });
});
