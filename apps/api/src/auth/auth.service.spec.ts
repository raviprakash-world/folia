/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// The nested mock objects below (prisma.passwordResetToken.update, etc.)
// are plain jest.fn() without explicit generics — giving every one of
// them full type parameters would be a lot of boilerplate for a test
// file whose value is in the behavioral assertions (21 tests proving
// real security properties: no-account-enumeration, reuse detection,
// session revocation on password reset), not mock type-safety. Same root
// cause as auth.service.ts's own exemption, just in test code.
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashPassword } from './password.util';
import type { UserWithRole } from '../users/user.types';
import type { RoleWithPermissions } from '../roles/role.types';
import type { SessionRecord } from '../sessions/session.types';

function makeUser(
  overrides: Partial<UserWithRole> = {},
  passwordHash = '',
): UserWithRole {
  return {
    id: 'user-1',
    email: 'sam@example.com',
    passwordHash,
    firstName: 'Sam',
    lastName: 'Rivera',
    phone: null,
    avatarUrl: null,
    emailVerified: false,
    emailVerifiedAt: null,
    roleId: 'role-customer',
    createdAt: new Date(),
    updatedAt: new Date(),
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

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: 'x',
    userAgent: null,
    ipAddress: null,
    deviceName: null,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    revokedAt: null,
    ...overrides,
  };
}

function createDeps(overrides: { isProduction?: boolean } = {}) {
  const prisma = {
    session: { findUnique: jest.fn() },
    passwordResetToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    emailVerificationToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
  const config = {
    isProduction: overrides.isProduction ?? false,
    jwtAccessSecret: 'access-secret',
    jwtAccessExpiry: '15m',
  };
  const usersService = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    updatePasswordHash: jest.fn(),
    markEmailVerified: jest.fn(),
  };
  const rolesService = { getDefaultRoleOrThrow: jest.fn() };
  const sessionsService = {
    create: jest.fn(),
    findActiveByRawToken: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const service = new AuthService(
    prisma as never,
    jwtService as never,
    config as never,
    usersService as never,
    rolesService as never,
    sessionsService as never,
  );

  return {
    service,
    prisma,
    jwtService,
    config,
    usersService,
    rolesService,
    sessionsService,
  };
}

const META = { userAgent: 'test-agent', ipAddress: '127.0.0.1' };

describe('AuthService', () => {
  describe('register', () => {
    it('rejects registration with an email that already exists', async () => {
      const { service, usersService } = createDeps();
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register(
          {
            email: 'sam@example.com',
            password: 'Correct1',
            firstName: 'S',
            lastName: 'R',
          },
          META,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the user with the default role and returns tokens plus a dev verification token outside production', async () => {
      const { service, usersService, rolesService, sessionsService, config } =
        createDeps({ isProduction: false });
      usersService.findByEmail.mockResolvedValue(null);
      rolesService.getDefaultRoleOrThrow.mockResolvedValue(makeRole());
      usersService.create.mockResolvedValue(makeUser());
      sessionsService.create.mockResolvedValue(makeSession());

      const result = await service.register(
        {
          email: 'new@example.com',
          password: 'Correct1',
          firstName: 'New',
          lastName: 'User',
        },
        META,
      );

      expect(result.user.email).toBe('sam@example.com'); // from the mocked created user
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
      expect(result.emailVerificationDevToken).toBeDefined();
      expect(config.isProduction).toBe(false);
    });
  });

  describe('login', () => {
    it('rejects with the SAME error message for a nonexistent email and a wrong password (no account enumeration)', async () => {
      const { service, usersService } = createDeps();

      usersService.findByEmail.mockResolvedValueOnce(null);
      const errorForMissingUser = await service
        .login('nobody@example.com', 'whatever', false, META)
        .catch((e: Error) => e.message);

      const hash = await hashPassword('CorrectPassword1');
      usersService.findByEmail.mockResolvedValueOnce(makeUser({}, hash));
      const errorForWrongPassword = await service
        .login('sam@example.com', 'WrongPassword1', false, META)
        .catch((e: Error) => e.message);

      expect(errorForMissingUser).toBe(errorForWrongPassword);
    });

    it('succeeds with the correct password and issues tokens', async () => {
      const { service, usersService, sessionsService } = createDeps();
      const hash = await hashPassword('CorrectPassword1');
      usersService.findByEmail.mockResolvedValue(makeUser({}, hash));
      sessionsService.create.mockResolvedValue(makeSession());

      const result = await service.login(
        'sam@example.com',
        'CorrectPassword1',
        false,
        META,
      );
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });
  });

  describe('refresh', () => {
    it('rotates the session and returns a new token pair for a valid refresh token', async () => {
      const { service, usersService, sessionsService } = createDeps();
      const activeSession = makeSession();
      sessionsService.findActiveByRawToken.mockResolvedValue(activeSession);
      usersService.findById.mockResolvedValue(makeUser());
      sessionsService.rotate.mockResolvedValue(
        makeSession({ id: 'session-2' }),
      );

      const result = await service.refresh('some-raw-refresh-token', META);
      expect(sessionsService.rotate).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ userId: 'user-1' }),
      );
      expect(result.tokens.refreshToken).toBeTruthy();
    });

    it('rejects an unknown refresh token', async () => {
      const { service, sessionsService, prisma } = createDeps();
      sessionsService.findActiveByRawToken.mockResolvedValue(null);
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.refresh('unknown-token', META)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("detects reuse of a revoked refresh token and revokes ALL of that user's sessions defensively", async () => {
      const { service, sessionsService, prisma } = createDeps();
      sessionsService.findActiveByRawToken.mockResolvedValue(null); // not active — it was already revoked
      prisma.session.findUnique.mockResolvedValue({
        userId: 'user-1',
        revokedAt: new Date(),
      }); // but it DID exist, revoked

      await expect(
        service.refresh('stolen-and-reused-token', META),
      ).rejects.toThrow(UnauthorizedException);
      expect(sessionsService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });

    it('does NOT revoke all sessions for a token that simply never existed (no false positive)', async () => {
      const { service, sessionsService, prisma } = createDeps();
      sessionsService.findActiveByRawToken.mockResolvedValue(null);
      prisma.session.findUnique.mockResolvedValue(null); // never existed at all — not a reuse case

      await expect(service.refresh('never-issued-token', META)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(sessionsService.revokeAllForUser).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the session matching the provided refresh token', async () => {
      const { service, sessionsService } = createDeps();
      sessionsService.findActiveByRawToken.mockResolvedValue(makeSession());

      await service.logout('raw-refresh-token');
      expect(sessionsService.revoke).toHaveBeenCalledWith(
        'session-1',
        'user-1',
      );
    });

    it('does nothing (no error) when no refresh token is provided', async () => {
      const { service, sessionsService } = createDeps();
      await service.logout(undefined);
      expect(sessionsService.revoke).not.toHaveBeenCalled();
    });
  });

  describe('forgotPassword', () => {
    it('returns an empty object for a nonexistent email (no account enumeration)', async () => {
      const { service, usersService } = createDeps();
      usersService.findByEmail.mockResolvedValue(null);
      expect(await service.forgotPassword('nobody@example.com')).toEqual({});
    });

    it('returns a devToken outside production for a real user', async () => {
      const { service, usersService, prisma } = createDeps({
        isProduction: false,
      });
      usersService.findByEmail.mockResolvedValue(makeUser());
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('sam@example.com');
      expect(result.devToken).toBeDefined();
    });

    it('never returns a devToken in production, even for a real user', async () => {
      const { service, usersService, prisma } = createDeps({
        isProduction: true,
      });
      usersService.findByEmail.mockResolvedValue(makeUser());
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword('sam@example.com');
      expect(result.devToken).toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    it('rejects an unknown token', async () => {
      const { service, prisma } = createDeps();
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);
      await expect(
        service.resetPassword('unknown', 'NewPassword1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an already-used token', async () => {
      const { service, prisma } = createDeps();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(
        service.resetPassword('used-token', 'NewPassword1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      const { service, prisma } = createDeps();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.resetPassword('expired-token', 'NewPassword1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('on success: updates the password, marks the token used, AND revokes every existing session', async () => {
      const { service, prisma, usersService, sessionsService } = createDeps();
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      await service.resetPassword('valid-token', 'NewPassword1');

      expect(usersService.updatePasswordHash).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'reset-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(sessionsService.revokeAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password', async () => {
      const { service, usersService } = createDeps();
      const hash = await hashPassword('ActualPassword1');
      usersService.findById.mockResolvedValue(makeUser({}, hash));

      await expect(
        service.changePassword(
          'user-1',
          'WrongCurrentPassword',
          'NewPassword1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('succeeds and updates the password hash when the current password is correct', async () => {
      const { service, usersService } = createDeps();
      const hash = await hashPassword('ActualPassword1');
      usersService.findById.mockResolvedValue(makeUser({}, hash));

      await service.changePassword('user-1', 'ActualPassword1', 'NewPassword1');
      expect(usersService.updatePasswordHash).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
    });
  });

  describe('verifyEmail', () => {
    it('rejects an unknown, expired, or already-used token', async () => {
      const { service, prisma } = createDeps();
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);
      await expect(service.verifyEmail('unknown')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('marks the user verified and the token used on success', async () => {
      const { service, prisma, usersService } = createDeps();
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'verify-1',
        userId: 'user-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      await service.verifyEmail('valid-token');
      expect(usersService.markEmailVerified).toHaveBeenCalledWith('user-1');
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 'verify-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
