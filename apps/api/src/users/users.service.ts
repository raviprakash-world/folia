/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
// KNOWN ENVIRONMENT-SPECIFIC EXEMPTION, not a blanket "trust me": every
// `this.prisma.<model>.<method>()` call below is flagged as unsafe
// because @prisma/client's pre-generation stub types PrismaClient as
// `any` — see prisma.service.ts's top-of-file comment and the root
// README's "Known Issues" for the full explanation (this note is
// intentionally short so it doesn't repeat that explanation in every
// Prisma-touching file). Each return is cast to this file's own
// hand-written UserWithRole type (see user.types.ts) immediately, so
// type safety resumes at the service boundary even though it's absent
// for the one line making the actual Prisma call.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserWithRole } from './user.types';

const USER_WITH_ROLE_INCLUDE = {
  role: { include: { permissions: { select: { key: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: USER_WITH_ROLE_INCLUDE,
    }) as Promise<UserWithRole | null>;
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_WITH_ROLE_INCLUDE,
    }) as Promise<UserWithRole | null>;
  }

  async create(input: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    roleId: string;
  }): Promise<UserWithRole> {
    return this.prisma.user.create({
      data: { ...input, email: input.email.toLowerCase() },
      include: USER_WITH_ROLE_INCLUDE,
    }) as Promise<UserWithRole>;
  }

  async updateProfile(
    id: string,
    input: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      avatarUrl?: string;
    },
  ): Promise<UserWithRole> {
    return this.prisma.user.update({
      where: { id },
      data: { ...input, email: input.email.toLowerCase() },
      include: USER_WITH_ROLE_INCLUDE,
    }) as Promise<UserWithRole>;
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
  }
}
