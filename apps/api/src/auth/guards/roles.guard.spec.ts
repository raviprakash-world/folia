import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { AuthenticatedUser } from '../../users/user.types';

function makeContext(user: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeUser(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: 'user-1',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.com',
    role: 'customer',
    permissions: [],
    ...overrides,
  };
}

describe('RolesGuard', () => {
  function createGuard(metadata: { roles?: string[]; permissions?: string[] }) {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) =>
        key === 'roles' ? metadata.roles : metadata.permissions,
      ),
    };
    return new RolesGuard(reflector as unknown as Reflector);
  }

  it('allows access when the route has no @Roles or @RequirePermissions metadata', () => {
    const guard = createGuard({});
    expect(guard.canActivate(makeContext(makeUser()))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const guard = createGuard({ roles: ['admin', 'staff'] });
    expect(guard.canActivate(makeContext(makeUser({ role: 'admin' })))).toBe(
      true,
    );
  });

  it('denies access when the user does not have a required role', () => {
    const guard = createGuard({ roles: ['admin'] });
    expect(() =>
      guard.canActivate(makeContext(makeUser({ role: 'customer' }))),
    ).toThrow(ForbiddenException);
  });

  it('allows access when the user has every required permission', () => {
    const guard = createGuard({ permissions: ['orders:read', 'orders:write'] });
    const user = makeUser({
      permissions: ['orders:read', 'orders:write', 'products:read'],
    });
    expect(guard.canActivate(makeContext(user))).toBe(true);
  });

  it('denies access when the user is missing even one required permission', () => {
    const guard = createGuard({
      permissions: ['orders:read', 'products:write'],
    });
    const user = makeUser({ permissions: ['orders:read'] }); // missing products:write
    expect(() => guard.canActivate(makeContext(user))).toThrow(
      ForbiddenException,
    );
  });

  it('denies a customer role from an admin-only route (realistic scenario)', () => {
    const guard = createGuard({ roles: ['admin'] });
    const customer = makeUser({
      role: 'customer',
      permissions: ['orders:read'],
    });
    expect(() => guard.canActivate(makeContext(customer))).toThrow(
      ForbiddenException,
    );
  });
});
