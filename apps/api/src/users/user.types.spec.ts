import { toPublicUser, toAuthenticatedUser } from './user.types';
import type { UserWithRole } from './user.types';

describe('toPublicUser', () => {
  const user: UserWithRole = {
    id: 'user-1',
    email: 'sam@example.com',
    passwordHash: 'super-secret-hash',
    firstName: 'Sam',
    lastName: 'Rivera',
    phone: '+14155552671',
    avatarUrl: '/uploads/avatars/x.png',
    emailVerified: true,
    emailVerifiedAt: new Date(),
    roleId: 'role-customer',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    role: {
      id: 'role-customer',
      name: 'customer',
      description: null,
      permissions: [],
    },
  };

  it('never includes passwordHash in the public shape', () => {
    const result = toPublicUser(user);
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('flattens role to just its name, matching apps/web/src/types/auth.ts', () => {
    const result = toPublicUser(user);
    expect(result.role).toBe('customer');
  });

  it('converts null phone/avatarUrl to undefined, not null', () => {
    const result = toPublicUser({ ...user, phone: null, avatarUrl: null });
    expect(result.phone).toBeUndefined();
    expect(result.avatarUrl).toBeUndefined();
  });
});

describe('toAuthenticatedUser', () => {
  it('includes permissions flattened to their keys, on top of the public shape', () => {
    const user: UserWithRole = {
      id: 'user-1',
      email: 'admin@folia.example',
      passwordHash: 'hash',
      firstName: 'Admin',
      lastName: 'User',
      phone: null,
      avatarUrl: null,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      roleId: 'role-admin',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      role: {
        id: 'role-admin',
        name: 'admin',
        description: null,
        permissions: [{ key: 'orders:read' }, { key: 'products:write' }],
      },
    };

    const result = toAuthenticatedUser(user);
    expect(result.permissions).toEqual(['orders:read', 'products:write']);
    expect(result.role).toBe('admin');
    expect(result).not.toHaveProperty('passwordHash');
  });
});
