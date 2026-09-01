/**
 * Hand-written types matching prisma/schema.prisma's User model exactly.
 *
 * WHY THESE EXIST INSTEAD OF IMPORTING FROM '@prisma/client': Prisma only
 * generates model-specific types (e.g. `import type { User } from
 * '@prisma/client'`) as part of `prisma generate` — which cannot run in
 * the sandbox this was developed in (see the root README's Known Issues).
 * These are named distinctly (UserRecord, not User) specifically so they
 * are never confused with Prisma's own generated type once it exists.
 *
 * TODO once `prisma generate` has run successfully: delete this file and
 * replace every UserRecord/PublicUser reference with Prisma's generated
 * `User` type directly — these are a bridge, not a permanent parallel
 * type system.
 */
export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  roleId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface RoleRecord {
  id: string;
  name: string;
  description: string | null;
}

export interface UserWithRole extends UserRecord {
  role: RoleRecord & { permissions: { key: string }[] };
}

/** The shape actually returned to clients — never includes passwordHash. Matches apps/web/src/types/auth.ts's User exactly. */
export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role?: string;
}

/**
 * PublicUser plus the caller's permission keys — used ONLY internally as
 * `request.user` (populated by JwtStrategy.validate, read by RolesGuard).
 * Deliberately a *different* type from PublicUser, not an extension
 * returned as-is from any endpoint: the frontend's User type has no
 * `permissions` field, and adding one to what's actually sent over the
 * wire would be an unrequested, unnecessary contract change. Controllers
 * that return a user body construct PublicUser explicitly instead of
 * forwarding this type directly.
 */
export interface AuthenticatedUser extends PublicUser {
  permissions: string[];
}

export function toPublicUser(user: UserWithRole): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role.name,
  };
}

export function toAuthenticatedUser(user: UserWithRole): AuthenticatedUser {
  return {
    ...toPublicUser(user),
    permissions: user.role.permissions.map((p) => p.key),
  };
}
