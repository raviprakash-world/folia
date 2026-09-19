/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// expect.objectContaining/any matchers are typed `any` by jest.
import { BadRequestException } from '@nestjs/common';
import { CouponsService } from './coupons.service';

function decimal(value: number) {
  return { toNumber: () => value };
}

describe('CouponsService.validate', () => {
  it('normalizes the code with trim + uppercase before lookup, matching apps/web exactly', async () => {
    const prisma = {
      coupon: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new CouponsService(prisma as never);

    await service.validate('  folia10  ', 50).catch(() => undefined);
    expect(prisma.coupon.findUnique).toHaveBeenCalledWith({
      where: { code: 'FOLIA10' },
    });
  });

  it('rejects an unknown code with the exact frontend error message', async () => {
    const prisma = {
      coupon: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new CouponsService(prisma as never);
    await expect(service.validate('NOTREAL', 50)).rejects.toThrow(
      "That code isn't valid.",
    );
  });

  it('rejects an inactive coupon the same way as an unknown one', async () => {
    const prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'OLD',
          type: 'PERCENT',
          value: decimal(10),
          description: 'x',
          minSubtotal: null,
          isActive: false,
          expiresAt: null,
        }),
      },
    };
    const service = new CouponsService(prisma as never);
    await expect(service.validate('OLD', 50)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects an expired coupon', async () => {
    const prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'EXPIRED',
          type: 'PERCENT',
          value: decimal(10),
          description: 'x',
          minSubtotal: null,
          isActive: true,
          expiresAt: new Date(Date.now() - 1000),
        }),
      },
    };
    const service = new CouponsService(prisma as never);
    await expect(service.validate('EXPIRED', 50)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a subtotal below minSubtotal with the exact frontend error message format', async () => {
    const prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'WELCOME5',
          type: 'FIXED',
          value: decimal(5),
          description: '₹5 off orders over ₹25',
          minSubtotal: decimal(25),
          isActive: true,
          expiresAt: null,
        }),
      },
    };
    const service = new CouponsService(prisma as never);
    await expect(service.validate('WELCOME5', 20)).rejects.toThrow(
      'This code needs a ₹25 subtotal — add ₹5.00 more.',
    );
  });

  it('succeeds and returns the public shape for a valid, applicable coupon', async () => {
    const prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'FOLIA10',
          type: 'PERCENT',
          value: decimal(10),
          description: '10% off your order',
          minSubtotal: null,
          isActive: true,
          expiresAt: null,
        }),
      },
    };
    const service = new CouponsService(prisma as never);
    const result = await service.validate('FOLIA10', 100);
    expect(result).toEqual({
      code: 'FOLIA10',
      type: 'percent',
      value: 10,
      description: '10% off your order',
      minSubtotal: undefined,
    });
  });
});

describe('CouponsService.listActive', () => {
  it('lists only active, unexpired coupons in public shape (with expiry when set)', async () => {
    const expiresAt = new Date('2099-01-01T00:00:00.000Z');
    const prisma = {
      coupon: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'FOLIA10',
            type: 'PERCENT',
            value: decimal(10),
            description: '10% off your order',
            minSubtotal: null,
            isActive: true,
            expiresAt: null,
          },
          {
            code: 'WELCOME5',
            type: 'FIXED',
            value: decimal(200),
            description: '₹200 off',
            minSubtotal: decimal(1000),
            isActive: true,
            expiresAt,
          },
        ]),
      },
    };
    const service = new CouponsService(prisma as never);

    const result = await service.listActive();

    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
        }),
      }),
    );
    expect(result).toEqual([
      {
        code: 'FOLIA10',
        type: 'percent',
        value: 10,
        description: '10% off your order',
        minSubtotal: undefined,
      },
      {
        code: 'WELCOME5',
        type: 'fixed',
        value: 200,
        description: '₹200 off',
        minSubtotal: 1000,
        expiresAt: '2099-01-01T00:00:00.000Z',
      },
    ]);
  });
});
