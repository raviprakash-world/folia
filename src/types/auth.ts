/**
 * MOCK AUTH DOMAIN.
 * None of this is real security. Passwords are compared as plain strings
 * against a seeded in-memory list (src/data/users.ts), and the "JWT" below
 * (src/utils/fakeJwt.ts) is a base64 payload with no real signature — it
 * cannot be verified and proves nothing cryptographically. This exists to
 * demonstrate the auth *flow* (forms, protected routes, persisted session)
 * for a portfolio project, not to be copied into a production system.
 */

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Data URL from a local mock file upload — never a real server-hosted image. Size-capped in the UI (2MB). */
  avatarUrl?: string;
  /** Defaults to 'customer' when absent — only the seeded demo admin account has 'admin'. */
  role?: 'customer' | 'admin';
}

export interface AuthSession {
  user: User;
  token: string;
}

export class AuthError extends Error {}
