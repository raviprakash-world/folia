import { SessionsService } from './sessions.service';
import { hashToken } from '../auth/token.util';
import type { SessionRecord } from './session.types';

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: hashToken('raw-token'),
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    deviceName: null,
    createdAt: new Date(),
    lastUsedAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    revokedAt: null,
    ...overrides,
  };
}

function createMockPrisma() {
  return {
    session: {
      create: jest.fn<
        Promise<SessionRecord>,
        [{ data: { refreshTokenHash: string } }]
      >(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn<
        Promise<SessionRecord[]>,
        [{ where: { revokedAt: null }; orderBy: { lastUsedAt: string } }]
      >(),
    },
    $transaction: jest.fn(),
  };
}

describe('SessionsService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: SessionsService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new SessionsService(prisma as never);
  });

  describe('create', () => {
    it('stores only the hash of the refresh token, never the raw value', async () => {
      prisma.session.create.mockResolvedValue(makeSession());
      await service.create({
        userId: 'user-1',
        refreshTokenRaw: 'raw-secret-token',
        expiresAt: new Date(),
      });

      const callArg = prisma.session.create.mock.calls[0][0];
      expect(callArg.data.refreshTokenHash).toBe(hashToken('raw-secret-token'));
      expect(callArg.data.refreshTokenHash).not.toBe('raw-secret-token');
    });
  });

  describe('findActiveByRawToken', () => {
    it('finds a session by hashing the provided raw token', async () => {
      prisma.session.findUnique.mockResolvedValue(makeSession());
      await service.findActiveByRawToken('raw-token');

      expect(prisma.session.findUnique).toHaveBeenCalledWith({
        where: { refreshTokenHash: hashToken('raw-token') },
      });
    });

    it('returns null for a session that does not exist', async () => {
      prisma.session.findUnique.mockResolvedValue(null);
      expect(await service.findActiveByRawToken('unknown')).toBeNull();
    });

    it('returns null for a revoked session, even if not yet expired', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeSession({ revokedAt: new Date() }),
      );
      expect(await service.findActiveByRawToken('raw-token')).toBeNull();
    });

    it('returns null for an expired session, even if not revoked', async () => {
      prisma.session.findUnique.mockResolvedValue(
        makeSession({ expiresAt: new Date(Date.now() - 1000) }),
      );
      expect(await service.findActiveByRawToken('raw-token')).toBeNull();
    });

    it('returns the session when it is genuinely active', async () => {
      const session = makeSession();
      prisma.session.findUnique.mockResolvedValue(session);
      expect(await service.findActiveByRawToken('raw-token')).toEqual(session);
    });
  });

  describe('rotate', () => {
    it('revokes the old session and creates a new one in the same transaction', async () => {
      const newSession = makeSession({ id: 'session-2' });
      prisma.$transaction.mockResolvedValue([
        { id: 'session-1', revokedAt: new Date() },
        newSession,
      ]);

      const result = await service.rotate('session-1', {
        userId: 'user-1',
        refreshTokenRaw: 'new-raw-token',
        expiresAt: new Date(),
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('session-2');
    });
  });

  describe('revoke', () => {
    it("scopes revocation to both session id AND user id (never revoke another user's session)", async () => {
      prisma.session.updateMany.mockResolvedValue({ count: 1 });
      await service.revoke('session-1', 'user-1');

      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1', userId: 'user-1' },
        }),
      );
    });
  });

  describe('listActiveForUser', () => {
    it('only queries non-revoked, non-expired sessions, most recently used first', async () => {
      prisma.session.findMany.mockResolvedValue([]);
      await service.listActiveForUser('user-1');

      const callArg = prisma.session.findMany.mock.calls[0][0];
      expect(callArg.where.revokedAt).toBeNull();
      expect(callArg.orderBy.lastUsedAt).toBe('desc');
    });
  });
});
