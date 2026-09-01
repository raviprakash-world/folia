import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedUser } from '../../users/user.types';

interface RequestWithOptionalUser {
  user?: AuthenticatedUser;
}

/**
 * Like @CurrentUser(), but explicitly optional — for routes guarded by
 * OptionalJwtAuthGuard rather than the standard JwtAuthGuard, where
 * request.user may genuinely be undefined (an anonymous cart request). A
 * separate decorator rather than making @CurrentUser() itself optional,
 * since every existing use of @CurrentUser() relies on it never being
 * undefined — weakening that contract for one new use case would be worse
 * than adding a second, explicit one.
 */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestWithOptionalUser>();
    return request.user;
  },
);
