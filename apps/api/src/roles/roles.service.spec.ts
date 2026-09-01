import { NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import type { RoleWithPermissions } from './role.types';

function makeRole(
  overrides: Partial<RoleWithPermissions> = {},
): RoleWithPermissions {
  return {
    id: 'role-customer',
    name: 'customer',
    description: null,
    permissions: [],
    ...overrides,
  };
}

describe('RolesService', () => {
  it('findByName returns null when no role matches', async () => {
    const prisma = { role: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new RolesService(prisma as never);
    expect(await service.findByName('nonexistent')).toBeNull();
  });

  it('getDefaultRoleOrThrow returns the seeded customer role', async () => {
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(makeRole()) },
    };
    const service = new RolesService(prisma as never);
    const role = await service.getDefaultRoleOrThrow();
    expect(role.name).toBe('customer');
  });

  it('getDefaultRoleOrThrow throws a clear, actionable error when unseeded', async () => {
    const prisma = { role: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new RolesService(prisma as never);
    await expect(service.getDefaultRoleOrThrow()).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.getDefaultRoleOrThrow()).rejects.toThrow(
      /prisma:seed/,
    );
  });
});
