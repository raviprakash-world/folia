import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthenticatedUser } from '../../users/user.types';

interface RequestWithUser {
  user: AuthenticatedUser;
}

/**
 * Checked after JwtAuthGuard (which populates request.user) — routes with
 * no @Roles()/@RequirePermissions() metadata pass through unrestricted;
 * this only *narrows* access on top of "must be authenticated," never
 * grants it.
 */
@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (requiredRoles?.length && !requiredRoles.includes(user.role ?? '')) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }

    if (requiredPermissions?.length) {
      const userPermissions = new Set(user.permissions);
      const missing = requiredPermissions.filter(
        (p) => !userPermissions.has(p),
      );
      if (missing.length > 0) {
        throw new ForbiddenException(
          'You do not have permission to access this resource.',
        );
      }
    }

    return true;
  }
}
