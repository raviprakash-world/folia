import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import { toAuthenticatedUser } from '../../users/user.types';
import type { JwtPayload } from '../jwt-payload.interface';

interface RequestWithOptionalUser extends Request {
  user?: ReturnType<typeof toAuthenticatedUser>;
}

/**
 * Phase 13 real-environment fix — the original version of this guard
 * extended AuthGuard('jwt'), the same Passport strategy name the global
 * JwtAuthGuard also wraps. Confirmed live (not assumed) that chaining two
 * separate NestJS guard classes both wrapping the same 'jwt' strategy
 * name causes the second one to never actually populate request.user,
 * even with a genuinely valid, present Authorization header — visible in
 * real backend logs as a guest cart cookie being issued on every single
 * cart request, including authenticated ones. Rewritten to verify the
 * token directly instead, sidestepping the double-guard interaction
 * entirely rather than trying to patch around it. Same real
 * database-reverification logic as JwtStrategy.validate() (Phase 1) —
 * intentionally duplicated rather than shared, since JwtStrategy's own
 * validate() is invoked by Passport's internal machinery, not callable
 * directly as a plain function.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOptionalUser>();
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true; // no token at all — proceed as guest

    const token = authHeader.slice('Bearer '.length);
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.jwtAccessSecret,
      });
      const user = await this.usersService.findById(payload.sub);
      if (user) request.user = toAuthenticatedUser(user);
    } catch {
      // An invalid/expired token on an optional-auth route is not an
      // error — treat it exactly like no token at all (proceed as
      // guest), matching this guard's whole purpose.
    }
    return true;
  }
}
