import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import { toAuthenticatedUser } from '../../users/user.types';
import type { JwtPayload } from '../jwt-payload.interface';
import type { AuthenticatedUser } from '../../users/user.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  /**
   * Re-verifies against the database on every request rather than trusting
   * the JWT payload's role/permissions blindly — a token stays
   * cryptographically valid until it expires even if the user's role
   * changed or their account was deactivated seconds after the token was
   * issued. This is one extra query per authenticated request in exchange
   * for that not being a real gap; Phase 10's caching work is the right
   * place to optimize this further if profiling shows it matters.
   */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('This account no longer exists.');
    }
    return toAuthenticatedUser(user);
  }
}
