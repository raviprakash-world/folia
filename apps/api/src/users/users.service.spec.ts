import { UsersService } from './users.service';
import type { UserWithRole } from './user.types';

function makeUser(overrides: Partial<UserWithRole> = {}): UserWithRole {
  return {
    id: 'user-1',
    email: 'sam@example.com',
    passwordHash: 'hashed',
    firstName: 'Sam',
    lastName: 'Rivera',
    phone: null,
    avatarUrl: null,
    emailVerified: false,
    emailVerifiedAt: null,
    roleId: 'role-customer',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    role: {
      id: 'role-customer',
      name: 'customer',
      description: null,
      permissions: [{ key: 'orders:read' }],
    },
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn(),
      create: jest.fn<Promise<UserWithRole>, [{ data: { email: string } }]>(),
      update: jest.fn<
        Promise<UserWithRole>,
        [{ data: Record<string, unknown> }]
      >(),
    },
  };
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: UsersService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UsersService(prisma as never);
  });

  describe('findByEmail', () => {
    it('lowercases the email and excludes soft-deleted users', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      await service.findByEmail('Sam@Example.COM');

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'sam@example.com', deletedAt: null },
        }),
      );
    });

    it('returns null when no user matches', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      expect(await service.findByEmail('nobody@example.com')).toBeNull();
    });
  });

  describe('findById', () => {
    it('excludes soft-deleted users by id too', async () => {
      prisma.user.findFirst.mockResolvedValue(makeUser());
      await service.findById('user-1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1', deletedAt: null } }),
      );
    });
  });

  describe('create', () => {
    it('lowercases the email on creation', async () => {
      prisma.user.create.mockResolvedValue(makeUser());
      await service.create({
        email: 'Sam@Example.COM',
        passwordHash: 'hashed',
        firstName: 'Sam',
        lastName: 'Rivera',
        roleId: 'role-customer',
      });

      const callArg = prisma.user.create.mock.calls[0][0];
      expect(callArg.data.email).toBe('sam@example.com');
    });
  });

  describe('updateProfile', () => {
    it('lowercases the email on update, same as create', async () => {
      prisma.user.update.mockResolvedValue(makeUser());
      await service.updateProfile('user-1', {
        firstName: 'Sam',
        lastName: 'Rivera',
        email: 'New@Example.COM',
      });

      const callArg = prisma.user.update.mock.calls[0][0] as {
        data: { email: string };
      };
      expect(callArg.data.email).toBe('new@example.com');
    });
  });

  describe('markEmailVerified', () => {
    it('sets both emailVerified and emailVerifiedAt', async () => {
      prisma.user.update.mockResolvedValue(makeUser());
      await service.markEmailVerified('user-1');

      const callArg = prisma.user.update.mock.calls[0][0] as {
        data: { emailVerified: boolean; emailVerifiedAt: Date };
      };
      expect(callArg.data.emailVerified).toBe(true);
      expect(callArg.data.emailVerifiedAt).toBeInstanceOf(Date);
    });
  });
});
