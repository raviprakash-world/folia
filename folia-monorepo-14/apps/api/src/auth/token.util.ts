import { randomBytes, createHash } from 'crypto';

const RAW_TOKEN_BYTES = 32; // 256 bits — matches the entropy of a standard secure session token

/**
 * Generates a raw, high-entropy bearer token (for refresh tokens, password
 * reset links, email verification links) and its SHA-256 hash separately.
 * Only the hash is ever stored (in Session/PasswordResetToken/
 * EmailVerificationToken) — the raw value is a bearer secret, exactly like
 * a password, and storing it in plaintext would mean a database leak
 * instantly compromises every active session and pending reset link.
 */
export function generateSecureToken(): { raw: string; hash: string } {
  const raw = randomBytes(RAW_TOKEN_BYTES).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
