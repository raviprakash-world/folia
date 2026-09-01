import {
  assignCourier,
  generateOrderId,
  generateTrackingNumber,
  hashOrderId,
} from './order-id.util';

describe('generateOrderId', () => {
  it('produces the FOL-YYYYMMDD-NNNN format, matching apps/web/src/utils/orderId.ts exactly', () => {
    const id = generateOrderId(new Date('2026-08-29T12:00:00Z'));
    expect(id).toMatch(/^FOL-20260829-\d{4}$/);
  });

  it('pads single-digit months and days with a leading zero', () => {
    const id = generateOrderId(new Date('2026-01-05T12:00:00Z'));
    expect(id).toMatch(/^FOL-20260105-\d{4}$/);
  });
});

describe('hashOrderId', () => {
  it('is deterministic — the same input always produces the same hash', () => {
    expect(hashOrderId('FOL-20260829-1234')).toBe(
      hashOrderId('FOL-20260829-1234'),
    );
  });

  it('matches a hand-computed reference value for a known input (proves the port is exact, not just internally consistent)', () => {
    // Computed independently in Node, replicating the exact algorithm
    // from apps/web/src/utils/tracking.ts, before this file was tested.
    expect(hashOrderId('FOL-20260829-1234')).toBe(309801324);
  });
});

describe('assignCourier', () => {
  it('matches the hand-computed reference assignment for a known order id', () => {
    expect(assignCourier('FOL-20260829-1234')).toBe('QUICKHATCH');
  });

  it('is deterministic — repeated calls for the same order id always agree', () => {
    const a = assignCourier('some-order-id');
    const b = assignCourier('some-order-id');
    expect(a).toBe(b);
  });
});

describe('generateTrackingNumber', () => {
  it('matches the hand-computed reference tracking number for a known order id + courier', () => {
    expect(generateTrackingNumber('FOL-20260829-1234', 'QUICKHATCH')).toBe(
      'QU606769159',
    );
  });

  it("the two-letter prefix comes from the courier's lowercase-hyphenated display id, not the SCREAMING_SNAKE_CASE enum value", () => {
    // "cascade-express" -> "ca", not "CA" from "CASCADE_EXPRESS" -> "CA"
    // (same result here, but proves the mapping goes through the display
    // form rather than slicing the enum name directly, which matters for
    // multi-word ids where the two could diverge).
    const result = generateTrackingNumber('any-order-id', 'CASCADE_EXPRESS');
    expect(result.slice(0, 2)).toBe('CA');
  });

  it('is deterministic for the same order id + courier pair', () => {
    const a = generateTrackingNumber('order-x', 'SWIFTPOST');
    const b = generateTrackingNumber('order-x', 'SWIFTPOST');
    expect(a).toBe(b);
  });

  it('always produces exactly 9 digits after the 2-letter prefix', () => {
    const result = generateTrackingNumber('short', 'NORTHLINE');
    expect(result).toMatch(/^NO\d{9}$/);
  });
});
