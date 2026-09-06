// See users/users.service.ts's top-of-file comment for why this exemption
// exists — this file's PasswordResetToken/EmailVerificationToken queries
// go through PrismaService directly (there's no dedicated repository
// service for them; they're simple enough not to need one yet).
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { StringValue as MsStringValue } from 'ms';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
import { SessionsService } from '../sessions/sessions.service';
import { EMAIL_SERVICE } from '../email/email.interface';
import type { EmailService } from '../email/email.interface';
import {
  passwordResetEmail,
  emailVerificationEmail,
} from '../email/email-templates';
import { hashPassword, verifyPassword } from './password.util';
import { generateSecureToken, hashToken } from './token.util';
import { toAuthenticatedUser, toPublicUser } from '../users/user.types';
import {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_MINUTES,
  REFRESH_TOKEN_TTL_DAYS_DEFAULT,
  REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME,
} from './auth.constants';
import type { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './jwt-payload.interface';
import type { AuthenticatedUser, PublicUser } from '../users/user.types';

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly sessionsService: SessionsService,
    @Inject(EMAIL_SERVICE) private readonly emailService: EmailService,
  ) {}

  /** Never throws, never blocks the caller — an unconfigured/down email provider must not break registration, password reset, or anything else upstream of it. Logged, not silently swallowed. */
  private async sendEmailSafely(
    to: string,
    build: () => { subject: string; html: string; text: string },
    context: string,
  ): Promise<void> {
    try {
      const { subject, html, text } = build();
      await this.emailService.send({ to, subject, html, text });
    } catch (err) {
      this.logger.warn(
        `Could not send ${context} email to ${to}: ${(err as Error).message}`,
      );
    }
  }

  // --- Registration & login ---

  async register(
    dto: RegisterDto,
    meta: RequestMeta,
  ): Promise<AuthResult & { emailVerificationDevToken?: string }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const [passwordHash, defaultRole] = await Promise.all([
      hashPassword(dto.password),
      this.rolesService.getDefaultRoleOrThrow(),
    ]);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      roleId: defaultRole.id,
    });

    const tokens = await this.issueTokenPair(
      user.id,
      toAuthenticatedUser(user),
      meta,
      false,
    );
    const emailVerificationDevToken = await this.createEmailVerificationToken(
      user.id,
      user.email,
    );

    this.logger.log(`New account registered: ${user.email}`);
    return { user: toPublicUser(user), tokens, emailVerificationDevToken };
  }

  async login(
    email: string,
    password: string,
    rememberMe: boolean,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);
    // Deliberately the same error for "no such user" and "wrong password"
    // — a distinct message would let an attacker enumerate which emails
    // have accounts.
    const invalidCredentials = () =>
      new UnauthorizedException('Incorrect email or password.');
    if (!user) throw invalidCredentials();

    const passwordValid = await verifyPassword(user.passwordHash, password);
    if (!passwordValid) throw invalidCredentials();

    const tokens = await this.issueTokenPair(
      user.id,
      toAuthenticatedUser(user),
      meta,
      rememberMe,
    );
    return { user: toPublicUser(user), tokens };
  }

  async logout(refreshTokenRaw: string | undefined): Promise<void> {
    if (!refreshTokenRaw) return;
    const session =
      await this.sessionsService.findActiveByRawToken(refreshTokenRaw);
    if (session) await this.sessionsService.revoke(session.id, session.userId);
  }

  /**
   * Refresh-token rotation with reuse detection: if the presented token
   * hashes to a session that exists but is already revoked, that's a
   * strong signal the refresh token was stolen and used by both the
   * legitimate client and an attacker — the legitimate client's next
   * refresh (after the attacker's) would hit a revoked session. The
   * defensive response is to revoke every session for that user, forcing
   * a fresh login everywhere, rather than silently ignoring the reuse.
   */
  async refresh(
    refreshTokenRaw: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const invalidToken = () =>
      new UnauthorizedException(
        'Your session has expired. Please sign in again.',
      );

    const activeSession =
      await this.sessionsService.findActiveByRawToken(refreshTokenRaw);
    if (!activeSession) {
      const possibleReuse = await this.prisma.session.findUnique({
        where: { refreshTokenHash: hashToken(refreshTokenRaw) },
      });
      if (
        possibleReuse &&
        (possibleReuse as { revokedAt: Date | null }).revokedAt
      ) {
        this.logger.warn(
          `Possible refresh token reuse detected for user ${(possibleReuse as { userId: string }).userId} — revoking all sessions.`,
        );
        await this.sessionsService.revokeAllForUser(
          (possibleReuse as { userId: string }).userId,
        );
      }
      throw invalidToken();
    }

    const user = await this.usersService.findById(activeSession.userId);
    if (!user) throw invalidToken();

    // Captured before calling rotate() — SessionsService.rotate() returns
    // the stored (hashed) session record, since the raw value is never
    // persisted (see token.util.ts). The caller that generates the new
    // raw token is the only place that ever has it, so it has to be kept
    // here rather than reconstructed from what rotate() returns.
    const newRefreshTokenRaw = generateSecureToken().raw;
    const rotated = await this.sessionsService.rotate(activeSession.id, {
      userId: user.id,
      refreshTokenRaw: newRefreshTokenRaw,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      deviceName: meta.deviceName,
      expiresAt: activeSession.expiresAt, // preserve the original remember-me window rather than resetting it
    });

    return {
      user: toPublicUser(user),
      tokens: {
        accessToken: this.signAccessToken(toAuthenticatedUser(user)),
        refreshToken: newRefreshTokenRaw,
        refreshTokenExpiresAt: rotated.expiresAt,
      },
    };
  }

  // --- Password reset ---

  /**
   * Always returns the same shape regardless of whether the email exists
   * — prevents account enumeration via this endpoint. devToken is only
   * ever populated outside production (unchanged dev convenience — lets
   * this flow be tested locally with no email provider configured at
   * all). The real email is now sent regardless of environment (Phase 3)
   * — this is the fix for the gap docs/SECURITY_STATUS.md flagged as
   * "production password reset does not work at all right now": the
   * token was always created correctly, nothing ever delivered it.
   */
  async forgotPassword(email: string): Promise<{ devToken?: string }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return {};

    const { raw, hash } = generateSecureToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(
          Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
        ),
      },
    });

    const resetUrl = `${this.config.frontendUrl}/account/reset-password?token=${raw}`;
    await this.sendEmailSafely(
      user.email,
      () => passwordResetEmail(resetUrl),
      'password-reset',
    );

    return this.config.isProduction ? {} : { devToken: raw };
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    const invalidOrExpired = () =>
      new UnauthorizedException('That reset link is invalid or has expired.');
    if (!record) throw invalidOrExpired();

    const typedRecord = record as {
      id: string;
      userId: string;
      usedAt: Date | null;
      expiresAt: Date;
    };
    if (typedRecord.usedAt || typedRecord.expiresAt < new Date())
      throw invalidOrExpired();

    const passwordHash = await hashPassword(newPassword);
    await this.usersService.updatePasswordHash(
      typedRecord.userId,
      passwordHash,
    );
    await this.prisma.passwordResetToken.update({
      where: { id: typedRecord.id },
      data: { usedAt: new Date() },
    });
    // A password reset is a strong "this account may have been
    // compromised" signal — invalidate every existing session so a stolen
    // session can't outlive the password that (possibly) leaked it.
    await this.sessionsService.revokeAllForUser(typedRecord.userId);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user)
      throw new UnauthorizedException('This account no longer exists.');

    const currentValid = await verifyPassword(
      user.passwordHash,
      currentPassword,
    );
    if (!currentValid)
      throw new UnauthorizedException('Your current password is incorrect.');

    const passwordHash = await hashPassword(newPassword);
    await this.usersService.updatePasswordHash(userId, passwordHash);
  }

  // --- Email verification ---

  /** Same real-email-now-sent-regardless-of-environment fix as forgotPassword — see that method's comment. */
  private async createEmailVerificationToken(
    userId: string,
    email: string,
  ): Promise<string | undefined> {
    const { raw, hash } = generateSecureToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
        ),
      },
    });

    const verifyUrl = `${this.config.frontendUrl}/account/verify-email?token=${raw}`;
    await this.sendEmailSafely(
      email,
      () => emailVerificationEmail(verifyUrl),
      'email-verification',
    );

    return this.config.isProduction ? undefined : raw;
  }

  async resendEmailVerification(
    userId: string,
  ): Promise<{ devToken?: string }> {
    const user = await this.usersService.findById(userId);
    if (!user)
      throw new UnauthorizedException('This account no longer exists.');
    const devToken = await this.createEmailVerificationToken(
      userId,
      user.email,
    );
    return { devToken };
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    const invalidOrExpired = () =>
      new UnauthorizedException(
        'That verification link is invalid or has expired.',
      );
    if (!record) throw invalidOrExpired();

    const typedRecord = record as {
      id: string;
      userId: string;
      usedAt: Date | null;
      expiresAt: Date;
    };
    if (typedRecord.usedAt || typedRecord.expiresAt < new Date())
      throw invalidOrExpired();

    await this.usersService.markEmailVerified(typedRecord.userId);
    await this.prisma.emailVerificationToken.update({
      where: { id: typedRecord.id },
      data: { usedAt: new Date() },
    });
  }

  // --- Shared token issuance ---

  private signAccessToken(user: AuthenticatedUser): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role ?? '',
      permissions: user.permissions,
    };
    return this.jwtService.sign(payload, {
      secret: this.config.jwtAccessSecret,
      // Cast justified by env.validation.ts's JWT_ACCESS_EXPIRY regex,
      // which guarantees this string matches the `ms` package's expected
      // duration format at boot — TypeScript can't see that runtime
      // guarantee through AppConfigService's plain `string` return type,
      // but the actual value is verified before the process ever starts.
      expiresIn: this.config.jwtAccessExpiry as MsStringValue,
    });
  }

  private async issueTokenPair(
    userId: string,
    authenticatedUser: AuthenticatedUser,
    meta: RequestMeta,
    rememberMe: boolean,
  ): Promise<TokenPair> {
    const days = rememberMe
      ? REFRESH_TOKEN_TTL_DAYS_REMEMBER_ME
      : REFRESH_TOKEN_TTL_DAYS_DEFAULT;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const { raw } = generateSecureToken();

    await this.sessionsService.create({
      userId,
      refreshTokenRaw: raw,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      deviceName: meta.deviceName,
      expiresAt,
    });

    return {
      accessToken: this.signAccessToken(authenticatedUser),
      refreshToken: raw,
      refreshTokenExpiresAt: expiresAt,
    };
  }
}
