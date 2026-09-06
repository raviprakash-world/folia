import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin typed wrapper over ConfigService — callers get typed getters
 * (`config.port`, not `config.get<number>('PORT')` repeated at every call
 * site with the type argument easy to get wrong or forget).
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV', 'development');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get port(): number {
    return this.configService.get<number>('PORT', 3000);
  }

  get databaseUrl(): string {
    return this.configService.getOrThrow<string>('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
  }

  get jwtAccessSecret(): string {
    return this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  get jwtRefreshSecret(): string {
    return this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  get jwtAccessExpiry(): string {
    return this.configService.get<string>('JWT_ACCESS_EXPIRY', '15m');
  }

  get jwtRefreshExpiry(): string {
    return this.configService.get<string>('JWT_REFRESH_EXPIRY', '30d');
  }

  get corsOrigins(): string[] {
    return this.configService
      .get<string>('CORS_ORIGINS', 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim());
  }

  /** Undefined, not thrown, when unset — see env.validation.ts's comment on why these three are optional at boot. RazorpayProvider throws its own clear error at the point a real call is actually attempted. */
  get razorpayKeyId(): string | undefined {
    return this.configService.get<string>('RAZORPAY_KEY_ID');
  }

  get razorpayKeySecret(): string | undefined {
    return this.configService.get<string>('RAZORPAY_KEY_SECRET');
  }

  get razorpayWebhookSecret(): string | undefined {
    return this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
  }

  /** Undefined, not thrown, when unset — see env.validation.ts's comment on why. ResendProvider throws its own clear error at the point a real send is actually attempted. */
  get resendApiKey(): string | undefined {
    return this.configService.get<string>('RESEND_API_KEY');
  }

  get resendFromEmail(): string {
    return this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'Folia <onboarding@resend.dev>',
    );
  }

  get frontendUrl(): string {
    return this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
  }
}
