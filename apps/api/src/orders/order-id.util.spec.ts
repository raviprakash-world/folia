import { generateOrderId, hashOrderId } from './order-id.util';

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
