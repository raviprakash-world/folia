import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { extractRequestMeta } from './request-meta.util';
import { REFRESH_TOKEN_COOKIE_NAME } from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.types';
import { AppConfigService } from '../config/app-config.service';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type { AuthenticatedUser, PublicUser } from '../users/user.types';
import type { StorageService } from '../storage/storage.interface';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // matches apps/web's existing 2MB limit exactly

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly sessionsService: SessionsService,
    private readonly config: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(STORAGE_SERVICE) private readonly storageService: StorageService,
  ) {}

  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/' });
  }

  @Public()
  @Post('register')
  @ApiOperation({
    summary:
      'Create an account. Sets an httpOnly refresh-token cookie; returns the access token in the body.',
  })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; token: string }> {
    const result = await this.authService.register(
      dto,
      extractRequestMeta(req),
    );
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );
    return { user: result.user, token: result.tokens.accessToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({
    summary:
      'Rate-limited to 5 attempts/minute per IP — brute-force protection.',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; token: string }> {
    const result = await this.authService.login(
      dto.email,
      dto.password,
      dto.rememberMe ?? false,
      extractRequestMeta(req),
    );
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );
    return { user: result.user, token: result.tokens.accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE_NAME
    ];
    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(res);
    return { ok: true };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Reads the refresh token from the httpOnly cookie (not the request body) and rotates it.',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: PublicUser; token: string }> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE_NAME
    ];
    if (!refreshToken) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('No active session.');
    }
    const result = await this.authService.refresh(
      refreshToken,
      extractRequestMeta(req),
    );
    this.setRefreshCookie(
      res,
      result.tokens.refreshToken,
      result.tokens.refreshTokenExpiresAt,
    );
    return { user: result.user, token: result.tokens.accessToken };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): PublicUser {
    const { permissions: _permissions, ...publicUser } = user;
    return publicUser;
  }

  @ApiBearerAuth()
  @Put('me')
  async updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PROFILE_UPDATED, {
      userId: user.id,
    });
    return toPublicUser(updated);
  }

  @ApiBearerAuth()
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: `Multipart upload, max ${MAX_AVATAR_BYTES / 1024 / 1024}MB, image/* only.`,
  })
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PublicUser> {
    if (!file) throw new BadRequestException('No file was uploaded.');
    if (file.size > MAX_AVATAR_BYTES) {
      throw new BadRequestException(
        `File is too large — the limit is ${MAX_AVATAR_BYTES / 1024 / 1024}MB.`,
      );
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed.');
    }

    const { url } = await this.storageService.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimetype: file.mimetype,
      directory: 'avatars',
    });

    const updated = await this.usersService.updateProfile(user.id, {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: url,
    });
    return toPublicUser(updated);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({
    summary:
      'Always returns the same shape whether or not the email exists — prevents account enumeration.',
  })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ ok: true; devToken?: string }> {
    const { devToken } = await this.authService.forgotPassword(dto.email);
    return { ok: true, devToken };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ ok: true }> {
    await this.authService.resetPassword(dto.token, dto.password);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ ok: true }> {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(NOTIFICATION_EVENTS.PASSWORD_CHANGED, {
      userId: user.id,
    });
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true; devToken?: string }> {
    const { devToken } = await this.authService.resendEmailVerification(
      user.id,
    );
    return { ok: true, devToken };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ ok: true }> {
    await this.authService.verifyEmail(dto.token);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({
    summary:
      "Lists this account's active sessions/devices — the real Session Management + Device Tracking surface.",
  })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const currentRefreshToken = (
      req.cookies as Record<string, string> | undefined
    )?.[REFRESH_TOKEN_COOKIE_NAME];
    const currentSession = currentRefreshToken
      ? await this.sessionsService.findActiveByRawToken(currentRefreshToken)
      : null;

    const sessions = await this.sessionsService.listActiveForUser(user.id);
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      deviceName: s.deviceName,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSession?.id,
    }));
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Revoke a specific session/device — scoped so you can only ever revoke your own.',
  })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
  ): Promise<{ ok: true }> {
    await this.sessionsService.revoke(sessionId, user.id);
    return { ok: true };
  }
}
