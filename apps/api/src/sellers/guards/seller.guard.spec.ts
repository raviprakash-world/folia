import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SellerGuard } from './seller.guard';
import { SellersService } from '../sellers.service';
import type { AuthenticatedUser } from '../../users/user.types';
import type { Seller } from '@prisma/client';

interface RequestShape {
  user: AuthenticatedUser;
  seller?: Seller;
}

function makeContext(request: RequestShape): {
  ctx: ExecutionContext;
  getRequest: () => RequestShape;
} {
  const ctx = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { ctx, getRequest: () => request };
}

function makeUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: 'user-1',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    role: 'seller',
    permissions: [],
    ...overrides,
  };
}

function makeSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: 'seller-1',
    userId: 'user-1',
    slug: 'test-seller',
    displayName: 'Test Seller',
    description: 'desc',
    logoUrl: null,
    contactEmail: 'seller@example.com',
    contactPhone: '+91 90000 00000',
    status: 'ACTIVE',
    appliedAt: new Date(),
    approvedAt: new Date(),
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('SellerGuard', () => {
  function createGuard(
    requiresSeller: boolean | undefined,
    findByUserId: jest.Mock,
  ) {
    const reflector = {
      getAllAndOverride: jest.fn(() => requiresSeller),
    };
    const sellersService = { findByUserId } as unknown as SellersService;
    return new SellerGuard(reflector as unknown as Reflector, sellersService);
  }

  it('passes through unrestricted when the route has no @RequireSeller metadata', async () => {
    const findByUserId = jest.fn();
    const guard = createGuard(undefined, findByUserId);
    const { ctx } = makeContext({ user: makeUser() });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('resolves the seller from the authenticated user id — never from a client-supplied id — and attaches it to the request', async () => {
    const seller = makeSeller();
    const findByUserId = jest.fn().mockResolvedValue(seller);
    const guard = createGuard(true, findByUserId);
    const { ctx, getRequest } = makeContext({
      user: makeUser({ id: 'user-1' }),
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(findByUserId).toHaveBeenCalledWith('user-1');
    expect(getRequest().seller).toBe(seller);
  });

  it('throws NotFoundException — not a distinguishing error — when the authenticated user has no seller account at all', async () => {
    const findByUserId = jest.fn().mockResolvedValue(null);
    const guard = createGuard(true, findByUserId);
    const { ctx } = makeContext({ user: makeUser() });

    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it("never resolves seller B's row for seller A, even if seller A's request somehow carried seller B's id anywhere — identity comes only from request.user.id", async () => {
    // Simulates the isolation guarantee directly: findByUserId is only ever
    // called with the authenticated user's own id, regardless of anything
    // else present on the request (there is no sellerId parameter for a
    // forged value to even be read from).
    const sellerA = makeSeller({ id: 'seller-A', userId: 'user-A' });
    const findByUserId = jest.fn((userId: string) =>
      Promise.resolve(userId === 'user-A' ? sellerA : null),
    );
    const guard = createGuard(true, findByUserId);
    const { ctx, getRequest } = makeContext({
      user: makeUser({ id: 'user-A' }),
    });

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(findByUserId).toHaveBeenCalledWith('user-A');
    expect(findByUserId).not.toHaveBeenCalledWith('user-B');
    expect(getRequest().seller?.id).toBe('seller-A');
  });
});
