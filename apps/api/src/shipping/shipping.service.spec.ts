import { BadRequestException } from '@nestjs/common';
import { ShippingService } from './shipping.service';
import type { ShippingProviderClient } from './providers/shipping-provider.interface';

function createDeps(
  overrides: Partial<Record<keyof ShippingProviderClient, jest.Mock>> = {},
) {
  const shippingProvider = {
    checkServiceability: jest
      .fn()
      .mockResolvedValue({ serviceable: false, couriers: [] }),
    createShipment: jest.fn(),
    trackShipment: jest.fn(),
    ...overrides,
  };
  const service = new ShippingService(shippingProvider);
  return { service, shippingProvider };
}

describe('ShippingService.estimate', () => {
  it('rejects a non-6-digit PIN code', async () => {
    const { service } = createDeps();
    await expect(service.estimate('123', 20)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.estimate('abcdef', 20)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.estimate('12345', 20)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('uses the real provider quote when Shiprocket reports the pincode serviceable', async () => {
    const { service, shippingProvider } = createDeps({
      checkServiceability: jest.fn().mockResolvedValue({
        serviceable: true,
        couriers: [
          {
            courierName: 'Slow Surface',
            rate: 60,
            etaDays: '5-7 days',
            codAvailable: true,
          },
          {
            courierName: 'Fast Air',
            rate: 40,
            etaDays: '2-3 days',
            codAvailable: false,
          },
        ],
      }),
    });

    const result = await service.estimate('560001', 20);

    expect(shippingProvider.checkServiceability).toHaveBeenCalledWith(
      expect.objectContaining({
        pickupPincode: '560001',
        deliveryPincode: '560001',
      }),
    );
    // Picks the cheapest of the real quotes, not the first one.
    expect(result).toEqual({ cost: 40, etaDays: '2-3 days' });
  });

  it('real quote still shows free shipping once subtotal clears the threshold', async () => {
    const { service } = createDeps({
      checkServiceability: jest.fn().mockResolvedValue({
        serviceable: true,
        couriers: [
          {
            courierName: 'Fast Air',
            rate: 40,
            etaDays: '2-3 days',
            codAvailable: false,
          },
        ],
      }),
    });

    const result = await service.estimate('560001', 75);
    expect(result.cost).toBe(0);
  });

  it('falls back to the flat-rate heuristic when Shiprocket is not configured (throws)', async () => {
    const { service } = createDeps({
      checkServiceability: jest
        .fn()
        .mockRejectedValue(new Error('Shiprocket is not configured')),
    });

    const result = await service.estimate('560001', 20);
    expect(result).toEqual({ cost: 6.5, etaDays: '2–4 business days' });
  });

  it('falls back to the flat-rate heuristic when Shiprocket reports the pincode unserviceable', async () => {
    const { service } = createDeps({
      checkServiceability: jest
        .fn()
        .mockResolvedValue({ serviceable: true, couriers: [] }),
    });

    const result = await service.estimate('560001', 20);
    expect(result).toEqual({ cost: 6.5, etaDays: '2–4 business days' });
  });

  it('is free once subtotal clears the ₹75 threshold via the fallback heuristic, regardless of region', async () => {
    const { service } = createDeps();
    await expect(service.estimate('902100', 75)).resolves.toEqual({
      cost: 0,
      etaDays: '3–5 business days',
    });
    await expect(service.estimate('100010', 100)).resolves.toEqual({
      cost: 0,
      etaDays: '3–5 business days',
    });
  });

  it('near-region fallback rate below the threshold', async () => {
    const { service } = createDeps();
    const result = await service.estimate('560001', 20);
    expect(result).toEqual({ cost: 6.5, etaDays: '2–4 business days' });
  });

  it('far-region fallback rate below the threshold', async () => {
    const { service } = createDeps();
    const result = await service.estimate('110001', 20);
    expect(result).toEqual({ cost: 9.5, etaDays: '4–6 business days' });
  });
});
