/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

function createDeps() {
  const prisma = {
    cart: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    cartItem: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    product: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'prod-1', price: { toNumber: () => 68 } }),
    },
  };
  const inventoryService = { getAvailability: jest.fn() };
  const service = new CartService(prisma as never, inventoryService as never);
  return { prisma, inventoryService, service };
}

const EMPTY_CART = (overrides: Record<string, unknown> = {}) => ({
  id: 'cart-1',
  userId: null,
  guestToken: null,
  items: [],
  ...overrides,
});

describe('CartService.resolveCart', () => {
  it('creates a new guest cart with a fresh token when no identity is given at all', async () => {
    const { prisma, service } = createDeps();
    prisma.cart.create.mockResolvedValue(
      EMPTY_CART({ guestToken: 'irrelevant-mock-value' }),
    );

    const result = await service.resolveCart(null, null);
    expect(result.newGuestToken).toBeDefined();
    expect(typeof result.newGuestToken).toBe('string');
  });

  it('returns the existing guest cart for a known guest token, without minting a new one', async () => {
    const { prisma, service } = createDeps();
    prisma.cart.findUnique.mockResolvedValue(
      EMPTY_CART({ guestToken: 'known-token' }),
    );

    const result = await service.resolveCart(null, 'known-token');
    expect(result.newGuestToken).toBeUndefined();
    expect(prisma.cart.create).not.toHaveBeenCalled();
  });

  it('creates a user cart on first access for an authenticated user with no guest cookie', async () => {
    const { prisma, service } = createDeps();
    prisma.cart.findUnique.mockResolvedValue(null); // no existing user cart
    prisma.cart.create.mockResolvedValue(EMPTY_CART({ userId: 'user-1' }));

    const result = await service.resolveCart('user-1', null);
    expect(result.cart.userId).toBe('user-1');
    expect(result.clearGuestCookie).toBe(false);
  });

  it('signals clearGuestCookie when a guest token was presented but there was nothing to merge', async () => {
    const { prisma, service } = createDeps();
    prisma.cart.findUnique
      .mockResolvedValueOnce(EMPTY_CART({ userId: 'user-1' })) // the user's own cart
      .mockResolvedValueOnce(null); // guest cart lookup — doesn't exist
    prisma.cart.delete.mockResolvedValue(undefined);

    const result = await service.resolveCart('user-1', 'stale-guest-token');
    expect(result.clearGuestCookie).toBe(true);
  });
});

describe('CartService merge-on-login', () => {
  it('combines quantities for a product+variant that exists in both carts, capped at real availability', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const userCart = EMPTY_CART({ userId: 'user-1' });
    const guestCart = {
      id: 'cart-guest',
      guestToken: 'g-token',
      items: [
        {
          productId: 'prod-1',
          variantId: null,
          quantity: 3,
          unitPrice: { toNumber: () => 68 },
        },
      ],
    };

    prisma.cart.findUnique
      .mockResolvedValueOnce(userCart) // user's cart lookup in resolveCart
      .mockResolvedValueOnce(guestCart); // guest cart lookup in mergeGuestCartIntoUserCart
    prisma.cartItem.findFirst.mockResolvedValue({
      id: 'existing-item',
      quantity: 2,
    }); // user already has 2
    inventoryService.getAvailability.mockResolvedValue(10); // plenty available
    prisma.cart.findUniqueOrThrow.mockResolvedValue(
      EMPTY_CART({ userId: 'user-1' }),
    );

    await service.resolveCart('user-1', 'g-token');

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'existing-item' },
      data: { quantity: 5 },
    }); // 2 + 3
    expect(prisma.cart.delete).toHaveBeenCalledWith({
      where: { id: 'cart-guest' },
    });
  });

  it('never lets the merged quantity exceed real availability, even if combined would', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const guestCart = {
      id: 'cart-guest',
      guestToken: 'g-token',
      items: [
        {
          productId: 'prod-1',
          variantId: null,
          quantity: 8,
          unitPrice: { toNumber: () => 68 },
        },
      ],
    };

    prisma.cart.findUnique
      .mockResolvedValueOnce(EMPTY_CART({ userId: 'user-1' }))
      .mockResolvedValueOnce(guestCart);
    prisma.cartItem.findFirst.mockResolvedValue({
      id: 'existing-item',
      quantity: 2,
    }); // 2 + 8 = 10 desired
    inventoryService.getAvailability.mockResolvedValue(5); // only 5 actually available
    prisma.cart.findUniqueOrThrow.mockResolvedValue(
      EMPTY_CART({ userId: 'user-1' }),
    );

    await service.resolveCart('user-1', 'g-token');

    // Capped at max(available=5, existing=2) = 5, not the naive 2+8=10.
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'existing-item' },
      data: { quantity: 5 },
    });
  });

  it('creates a new line for a guest item the user cart does not already have', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const guestCart = {
      id: 'cart-guest',
      guestToken: 'g-token',
      items: [
        {
          productId: 'prod-new',
          variantId: null,
          quantity: 1,
          unitPrice: { toNumber: () => 20 },
        },
      ],
    };

    prisma.cart.findUnique
      .mockResolvedValueOnce(EMPTY_CART({ userId: 'user-1' }))
      .mockResolvedValueOnce(guestCart);
    prisma.cartItem.findFirst.mockResolvedValue(null); // no existing line for this product
    inventoryService.getAvailability.mockResolvedValue(10);
    prisma.cart.findUniqueOrThrow.mockResolvedValue(
      EMPTY_CART({ userId: 'user-1' }),
    );

    await service.resolveCart('user-1', 'g-token');

    expect(prisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ productId: 'prod-new', quantity: 1 }),
      }),
    );
  });
});

describe('CartService.addItem', () => {
  it('rejects a non-positive quantity', async () => {
    const { service } = createDeps();
    await expect(service.addItem('cart-1', 'prod-1', null, 0)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFoundException for a product that does not exist (or is soft-deleted)', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(
      service.addItem('cart-1', 'unknown-product', null, 1),
    ).rejects.toThrow(NotFoundException);
  });

  it('looks up the real product price server-side rather than trusting any caller-supplied value — there is no unitPrice parameter to even pass', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.product.findFirst.mockResolvedValue({
      id: 'prod-1',
      price: { toNumber: () => 42.5 },
    });
    inventoryService.getAvailability.mockResolvedValue(10);
    prisma.cartItem.findFirst.mockResolvedValue(null);
    prisma.cart.findUniqueOrThrow.mockResolvedValue(EMPTY_CART());

    await service.addItem('cart-1', 'prod-1', null, 1);

    expect(prisma.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ unitPrice: 42.5 }),
      }),
    );
  });

  it('rejects adding more than what is actually available', async () => {
    const { prisma, inventoryService, service } = createDeps();
    inventoryService.getAvailability.mockResolvedValue(3);
    prisma.cartItem.findFirst.mockResolvedValue(null);

    await expect(service.addItem('cart-1', 'prod-1', null, 5)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('increments an existing line rather than creating a duplicate', async () => {
    const { prisma, inventoryService, service } = createDeps();
    inventoryService.getAvailability.mockResolvedValue(10);
    prisma.cartItem.findFirst.mockResolvedValue({ id: 'item-1', quantity: 2 });
    prisma.cart.findUniqueOrThrow.mockResolvedValue(EMPTY_CART());

    await service.addItem('cart-1', 'prod-1', null, 3);

    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { quantity: 5 },
    });
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });
});

describe('CartService.updateItemQuantity', () => {
  it('throws NotFoundException for a line that is not in the cart', async () => {
    const { prisma, service } = createDeps();
    prisma.cartItem.findFirst.mockResolvedValue(null);
    await expect(
      service.updateItemQuantity('cart-1', 'prod-1', null, 3),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects setting a quantity above real availability', async () => {
    const { prisma, inventoryService, service } = createDeps();
    prisma.cartItem.findFirst.mockResolvedValue({ id: 'item-1', quantity: 1 });
    inventoryService.getAvailability.mockResolvedValue(2);
    await expect(
      service.updateItemQuantity('cart-1', 'prod-1', null, 5),
    ).rejects.toThrow(BadRequestException);
  });
});
