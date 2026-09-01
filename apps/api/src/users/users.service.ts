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
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { RolesService } from '../roles/roles.service';
import type { UserWithRole } from './user.types';

const USER_WITH_ROLE_INCLUDE = {
  role: { include: { permissions: { select: { key: true } } } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionsService: SessionsService,
    private readonly rolesService: RolesService,
  ) {}

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

  /** Real admin visibility — genuinely new; every prior method here is either self-service or an internal auth-flow lookup, never a full listing. */
  async adminFindAll(): Promise<UserWithRole[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      include: USER_WITH_ROLE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    }) as Promise<UserWithRole[]>;
  }

  /**
   * Soft-deletes AND revokes every active session for the account in the
   * same operation — a deactivated account keeping a valid refresh token
   * around would make the deactivation meaningless. Reuses
   * SessionsService.revokeAllForUser (Phase 1) rather than duplicating
   * that logic here.
   */
  async adminDeactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.sessionsService.revokeAllForUser(id);
  }

  /** Validates the target role genuinely exists before assigning it — a typo'd or stale roleId should fail loudly here, not silently corrupt the user's permission set. */
  async adminUpdateRole(id: string, roleName: string): Promise<UserWithRole> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const role = await this.rolesService.findByName(roleName);
    if (!role)
      throw new NotFoundException(`Role "${roleName}" does not exist.`);

    return this.prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      include: USER_WITH_ROLE_INCLUDE,
    }) as Promise<UserWithRole>;
  }
}
