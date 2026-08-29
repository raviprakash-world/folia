import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AuthenticatedUser } from '../../users/user.types';

interface RequestWithUser {
  user: AuthenticatedUser;
}

/** Injects the authenticated user (set by JwtStrategy.validate) into a controller method — e.g. @CurrentUser() user: AuthenticatedUser. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
