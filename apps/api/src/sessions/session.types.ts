// See users/user.types.ts's top-of-file comment for why these are hand-written.
export interface SessionRecord {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** What's actually shown to a user managing their own sessions — never the token hash. */
export interface PublicSession {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}
