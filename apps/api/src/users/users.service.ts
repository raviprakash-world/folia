// P0-B — the manual `as Promise<UserWithRole...>` casts this file used
// to carry on every Prisma call (and the matching top-of-file
// eslint-disable) are gone: they existed only for the original
// development sandbox's pre-generation PrismaClient stub (typed `any`
// until `prisma generate` runs — see the root README's "Known Issues").
// In any environment where `prisma generate` has actually run — true
// for this one, and required in CI before lint/typecheck/build — the
// real generated types already match this file's declared return
// types, so `@typescript-eslint/no-unnecessary-type-assertion` is
// correct that the casts add nothing. UserWithRole (user.types.ts)
// stays as the service boundary's own hand-written contract regardless.
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
    });
  }

  async findById(id: string): Promise<UserWithRole | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: USER_WITH_ROLE_INCLUDE,
    });
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
    });
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
    });
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
    });
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
    });
  }
}
