import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from '../auth/token.util';
import type { SessionRecord } from './session.types';

export interface CreateSessionInput {
  userId: string;
  refreshTokenRaw: string;
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
  expiresAt: Date;
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateSessionInput): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        userId: input.userId,
        refreshTokenHash: hashToken(input.refreshTokenRaw),
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
        deviceName: input.deviceName,
        expiresAt: input.expiresAt,
      },
    });
  }

  /** Looks up an active (not revoked, not expired) session by its raw refresh token — the core of the refresh-token flow. */
  async findActiveByRawToken(
    refreshTokenRaw: string,
  ): Promise<SessionRecord | null> {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: hashToken(refreshTokenRaw) },
    });

    if (!session) return null;
    if (session.revokedAt) return null;
    if (session.expiresAt < new Date()) return null;
    return session;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.prisma.session.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * Refresh-token rotation: revokes the old session and issues a new one
   * atomically. Rotating on every refresh (rather than reusing the same
   * refresh token indefinitely) means a stolen-but-unused refresh token
   * becomes worthless the moment the legitimate user's client refreshes
   * again — a single successful reuse of a revoked token is a strong
   * signal of token theft, which callers can act on (see auth.service.ts).
   */
  async rotate(
    oldSessionId: string,
    input: CreateSessionInput,
  ): Promise<SessionRecord> {
    const [, newSession] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: oldSessionId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: input.userId,
          refreshTokenHash: hashToken(input.refreshTokenRaw),
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
          deviceName: input.deviceName,
          expiresAt: input.expiresAt,
        },
      }),
    ]);
    return newSession;
  }

  async revoke(id: string, userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, userId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async listActiveForUser(userId: string): Promise<SessionRecord[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
  }
}
