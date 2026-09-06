import { BadRequestException } from '@nestjs/common';
import { ShippingService } from './shipping.service';

describe('ShippingService.estimate', () => {
  const service = new ShippingService();

  it('rejects a non-5-digit ZIP', () => {
    expect(() => service.estimate('123', 20)).toThrow(BadRequestException);
    expect(() => service.estimate('abcde', 20)).toThrow(BadRequestException);
  });

  it('is free once subtotal clears the ₹75 threshold, regardless of region', () => {
    expect(service.estimate('90210', 75)).toEqual({
      cost: 0,
      etaDays: '3–5 business days',
    });
    expect(service.estimate('10001', 100)).toEqual({
      cost: 0,
      etaDays: '3–5 business days',
    });
  });

  it('charges the near-region rate for a ZIP starting 3-7, below the threshold', () => {
    expect(service.estimate('50001', 20)).toEqual({
      cost: 6.5,
      etaDays: '2–4 business days',
    });
  });

  it('charges the far-region rate for a ZIP starting 0-2 or 8-9, below the threshold', () => {
    expect(service.estimate('10001', 20)).toEqual({
      cost: 9.5,
      etaDays: '4–6 business days',
    });
    expect(service.estimate('90210', 20)).toEqual({
      cost: 9.5,
      etaDays: '4–6 business days',
    });
  });
});

describe('isFarRegion', () => {
  it('matches the exact boundary conditions from apps/web/src/utils/region.ts', async () => {
    const { isFarRegion } = await import('./region.util');
    expect(isFarRegion('20000')).toBe(true); // digit 2 — far
    expect(isFarRegion('30000')).toBe(false); // digit 3 — near
    expect(isFarRegion('70000')).toBe(false); // digit 7 — near
    expect(isFarRegion('80000')).toBe(true); // digit 8 — far
  });
});
