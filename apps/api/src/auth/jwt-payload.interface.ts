export interface JwtPayload {
  /** Subject — the user's id. */
  sub: string;
  email: string;
  role: string;
  permissions: string[];
}
