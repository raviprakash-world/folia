import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../config/app-config.service';
import type { EmailService, SendEmailInput } from '../email.interface';

/**
 * The one real email provider in this codebase (see
 * docs/API_INTEGRATION_STATUS.md). The client is constructed lazily (on
 * first real use, not in the constructor) specifically so this provider
 * can be instantiated — and the app can boot — with no RESEND_API_KEY
 * configured at all (a fresh checkout, CI, local dev before real keys
 * exist). It fails loudly and specifically the moment a real send is
 * actually attempted, matching this codebase's existing pattern for
 * RazorpayProvider.
 *
 * Resend's SDK does not throw on an API-level failure (invalid key,
 * unverified sending domain, rate limit) — it resolves with
 * `{ data: null, error }`. That's converted into a real thrown exception
 * here so callers can use ordinary try/catch, the same as every other
 * provider in this codebase.
 */
@Injectable()
export class ResendProvider implements EmailService {
  private client: Resend | null = null;

  constructor(private readonly config: AppConfigService) {}

  private getClient(): Resend {
    if (this.client) return this.client;

    const apiKey = this.config.resendApiKey;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Resend is not configured — RESEND_API_KEY is unset. Real emails cannot be sent until a Resend account exists and its key is set (see docs/API_INTEGRATION_STATUS.md).',
      );
    }
    this.client = new Resend(apiKey);
    return this.client;
  }

  async send(input: SendEmailInput): Promise<void> {
    const { error } = await this.getClient().emails.send({
      from: this.config.resendFromEmail,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      throw new InternalServerErrorException(
        `Resend rejected this email: ${error.message}`,
      );
    }
  }
}
