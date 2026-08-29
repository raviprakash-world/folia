// See users/user.types.ts's top-of-file comment — same reason these are
// hand-written instead of imported from '@prisma/client'.
export interface PermissionRecord {
  id: string;
  key: string;
  description: string | null;
}

export interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionRecord[];
}
