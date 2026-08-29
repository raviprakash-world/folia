import type { Request } from 'express';
import type { RequestMeta } from './auth.service';

/** Extracts device-tracking metadata from an Express request — real values, not placeholders. */
export function extractRequestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}
