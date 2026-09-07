import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RoleWithPermissions } from './role.types';

export const DEFAULT_ROLE_NAME = 'customer';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(name: string): Promise<RoleWithPermissions | null> {
    return this.prisma.role.findUnique({
      where: { name },
      include: { permissions: true },
    });
  }

  /** Used at registration — every new account gets the default "customer" role. Throws if the role hasn't been seeded (a real configuration error, not a normal runtime state). */
  async getDefaultRoleOrThrow(): Promise<RoleWithPermissions> {
    const role = await this.findByName(DEFAULT_ROLE_NAME);
    if (!role) {
      throw new NotFoundException(
        `Default role "${DEFAULT_ROLE_NAME}" is not seeded — run \`npm run prisma:seed\` before accepting registrations.`,
      );
    }
    return role;
  }
}
