import type { User } from '@/types/auth';

interface FakeJwtPayload {
  sub: string;
  email: string;
  iat: number;
}

/**
 * NOT a real JWT. Real JWTs are cryptographically signed and verified
 * server-side; this is a base64 blob anyone could forge in the browser
 * console. It exists so the auth store has a "token" to persist and send,
 * matching the shape of a real auth integration without pretending to be one.
 */
export function createFakeToken(user: User): string {
  const payload: FakeJwtPayload = { sub: user.id, email: user.email, iat: Date.now() };
  const encoded = btoa(JSON.stringify(payload));
  return `fake.${encoded}.unsigned`;
}

export function decodeFakeToken(token: string): FakeJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[1] === undefined) return null;
  try {
    return JSON.parse(atob(parts[1])) as FakeJwtPayload;
  } catch {
    return null;
  }
}
