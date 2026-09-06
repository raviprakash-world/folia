import {
  calculateShippingDeduction,
  deriveClaimType,
  DOA_CLAIM_WINDOW_MS,
  isReasonEligibleForClaimType,
  isWithinReturnWindow,
  requiresEvidence,
  RETURN_SHIPPING_DEDUCTION_INR,
  STANDARD_RETURN_WINDOW_MS,
} from './return-policy.util';

describe('deriveClaimType', () => {
  it('derives STANDARD_RETURN when every selected item is non-plant', () => {
    expect(
      deriveClaimType([{ categorySlug: 'vessels' }, { categorySlug: 'tools' }]),
    ).toBe('STANDARD_RETURN');
  });

  it('derives DOA_CLAIM when every selected item is a plant', () => {
    expect(deriveClaimType([{ categorySlug: 'plants' }])).toBe('DOA_CLAIM');
  });

  it('derives MIXED when the selection spans plant and non-plant items — the caller must reject this and ask for two separate claims', () => {
    expect(
      deriveClaimType([
        { categorySlug: 'plants' },
        { categorySlug: 'vessels' },
      ]),
    ).toBe('MIXED');
  });

  it('throws on an empty item list — a genuine caller-contract violation, not a business-ineligibility outcome', () => {
    expect(() => deriveClaimType([])).toThrow(
      'A claim must include at least one line item.',
    );
  });
});

describe('isReasonEligibleForClaimType', () => {
  it('accepts every STANDARD_RETURN reason for STANDARD_RETURN, including CHANGED_MIND', () => {
    for (const reason of [
      'NO_LONGER_NEEDED',
      'WRONG_ITEM',
      'DAMAGED_IN_TRANSIT',
      'NOT_AS_DESCRIBED',
      'CHANGED_MIND',
      'OTHER',
    ] as const) {
      expect(isReasonEligibleForClaimType('STANDARD_RETURN', reason)).toBe(
        true,
      );
    }
  });

  it('rejects DOA for STANDARD_RETURN — nothing non-plant can "arrive dead"', () => {
    expect(isReasonEligibleForClaimType('STANDARD_RETURN', 'DOA')).toBe(false);
  });

  it('accepts DOA, DAMAGED_IN_TRANSIT, and WRONG_ITEM for DOA_CLAIM', () => {
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'DOA')).toBe(true);
    expect(
      isReasonEligibleForClaimType('DOA_CLAIM', 'DAMAGED_IN_TRANSIT'),
    ).toBe(true);
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'WRONG_ITEM')).toBe(true);
  });

  it('rejects CHANGED_MIND for DOA_CLAIM — live plants are never change-of-mind eligible', () => {
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'CHANGED_MIND')).toBe(
      false,
    );
  });

  it('rejects NO_LONGER_NEEDED, NOT_AS_DESCRIBED, and OTHER for DOA_CLAIM', () => {
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'NO_LONGER_NEEDED')).toBe(
      false,
    );
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'NOT_AS_DESCRIBED')).toBe(
      false,
    );
    expect(isReasonEligibleForClaimType('DOA_CLAIM', 'OTHER')).toBe(false);
  });
});

describe('isWithinReturnWindow', () => {
  it('rejects when deliveredAt is null — no honest window to measure from', () => {
    expect(isWithinReturnWindow('STANDARD_RETURN', null)).toBe(false);
    expect(isWithinReturnWindow('DOA_CLAIM', null)).toBe(false);
  });

  it('allows a STANDARD_RETURN claim well within the 14-day window', () => {
    const now = new Date('2026-09-15T12:00:00.000Z');
    const deliveredAt = new Date('2026-09-10T12:00:00.000Z'); // 5 days ago
    expect(isWithinReturnWindow('STANDARD_RETURN', deliveredAt, now)).toBe(
      true,
    );
  });

  it('allows a STANDARD_RETURN claim exactly at the 14-day boundary (inclusive)', () => {
    const deliveredAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(deliveredAt.getTime() + STANDARD_RETURN_WINDOW_MS);
    expect(isWithinReturnWindow('STANDARD_RETURN', deliveredAt, now)).toBe(
      true,
    );
  });

  it('rejects a STANDARD_RETURN claim one millisecond past the 14-day boundary', () => {
    const deliveredAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(deliveredAt.getTime() + STANDARD_RETURN_WINDOW_MS + 1);
    expect(isWithinReturnWindow('STANDARD_RETURN', deliveredAt, now)).toBe(
      false,
    );
  });

  it('allows a DOA_CLAIM exactly at the 24-hour boundary (inclusive)', () => {
    const deliveredAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(deliveredAt.getTime() + DOA_CLAIM_WINDOW_MS);
    expect(isWithinReturnWindow('DOA_CLAIM', deliveredAt, now)).toBe(true);
  });

  it('rejects a DOA_CLAIM one millisecond past the 24-hour boundary', () => {
    const deliveredAt = new Date('2026-09-01T00:00:00.000Z');
    const now = new Date(deliveredAt.getTime() + DOA_CLAIM_WINDOW_MS + 1);
    expect(isWithinReturnWindow('DOA_CLAIM', deliveredAt, now)).toBe(false);
  });

  it('rejects a DOA_CLAIM that would still be well within the (much longer) STANDARD_RETURN window — the two windows are genuinely different, not a shared constant', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const deliveredAt = new Date('2026-09-05T12:00:00.000Z'); // 5 days ago — inside 14d, outside 24h
    expect(isWithinReturnWindow('STANDARD_RETURN', deliveredAt, now)).toBe(
      true,
    );
    expect(isWithinReturnWindow('DOA_CLAIM', deliveredAt, now)).toBe(false);
  });

  it('rejects when deliveredAt is somehow in the future (clock skew/bad data) rather than treating it as trivially within the window', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const deliveredAt = new Date('2026-09-11T12:00:00.000Z'); // 1 day "in the future"
    expect(isWithinReturnWindow('STANDARD_RETURN', deliveredAt, now)).toBe(
      false,
    );
    expect(isWithinReturnWindow('DOA_CLAIM', deliveredAt, now)).toBe(false);
  });

  it('allows a claim filed at the exact instant of delivery (zero elapsed time)', () => {
    const deliveredAt = new Date('2026-09-10T12:00:00.000Z');
    expect(
      isWithinReturnWindow('STANDARD_RETURN', deliveredAt, deliveredAt),
    ).toBe(true);
    expect(isWithinReturnWindow('DOA_CLAIM', deliveredAt, deliveredAt)).toBe(
      true,
    );
  });
});

describe('requiresEvidence', () => {
  it('requires evidence for DOA_CLAIM', () => {
    expect(requiresEvidence('DOA_CLAIM')).toBe(true);
  });

  it('does not require evidence for STANDARD_RETURN', () => {
    expect(requiresEvidence('STANDARD_RETURN')).toBe(false);
  });
});

describe('calculateShippingDeduction', () => {
  it('deducts RETURN_SHIPPING_DEDUCTION_INR for a genuinely customer-caused STANDARD_RETURN reason', () => {
    expect(calculateShippingDeduction('STANDARD_RETURN', 'CHANGED_MIND')).toBe(
      RETURN_SHIPPING_DEDUCTION_INR,
    );
    expect(
      calculateShippingDeduction('STANDARD_RETURN', 'NO_LONGER_NEEDED'),
    ).toBe(RETURN_SHIPPING_DEDUCTION_INR);
    expect(calculateShippingDeduction('STANDARD_RETURN', 'OTHER')).toBe(
      RETURN_SHIPPING_DEDUCTION_INR,
    );
  });

  it("never deducts for a STANDARD_RETURN reason that is Folia's fault, not the customer's", () => {
    expect(calculateShippingDeduction('STANDARD_RETURN', 'WRONG_ITEM')).toBe(0);
    expect(
      calculateShippingDeduction('STANDARD_RETURN', 'DAMAGED_IN_TRANSIT'),
    ).toBe(0);
    expect(
      calculateShippingDeduction('STANDARD_RETURN', 'NOT_AS_DESCRIBED'),
    ).toBe(0);
  });

  it("never deducts for DOA_CLAIM, regardless of reason — never the customer's fault", () => {
    expect(calculateShippingDeduction('DOA_CLAIM', 'DOA')).toBe(0);
    expect(calculateShippingDeduction('DOA_CLAIM', 'DAMAGED_IN_TRANSIT')).toBe(
      0,
    );
    expect(calculateShippingDeduction('DOA_CLAIM', 'WRONG_ITEM')).toBe(0);
  });
});
