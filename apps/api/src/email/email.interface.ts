export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback — required, not optional: some real inboxes/spam filters penalize HTML-only mail. */
  text: string;
}

/**
 * Email abstraction (same shape as storage.interface.ts's StorageService)
 * — every consumer (AuthService, EmailEventListener) depends on this
 * interface, injected via the EMAIL_SERVICE token, never on a concrete
 * implementation directly. ResendProvider is the only implementation
 * right now; swapping providers later means adding one new class that
 * implements this same interface and changing EmailModule's provider
 * binding — zero changes anywhere that calls it.
 */
export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
}

export const EMAIL_SERVICE = Symbol('EMAIL_SERVICE');
