import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/** Restricts a route to callers whose role has every listed permission key (e.g. @RequirePermissions('orders:read')). Checked by RolesGuard. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
