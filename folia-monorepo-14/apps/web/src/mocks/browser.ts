import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';
import { authHandlers } from './authHandlers';
import { catalogHandlers } from './catalogHandlers';
import { reviewsHandlers } from './reviewsHandlers';
import { addressHandlers } from './addressHandlers';
import { trackingHandlers } from './trackingHandlers';

/**
 * Phase 10/14 (backend integration), domain by domain — see
 * apps/api/CHANGELOG.md and this repo's INTEGRATION.md for the full
 * story. Each domain has its own flag, OFF by default: when off
 * (the default — nothing changes for the normal dev experience), every
 * handler for that domain is registered exactly as before. When a flag
 * is on, that domain's handlers are excluded so those specific requests
 * bypass MSW entirely (onUnhandledRequest: 'bypass', below) and reach
 * the real backend via vite.config.ts's matching proxy rule instead.
 * Domains not yet flagged on keep working exactly as before, unaffected.
 *
 * VITE_REAL_AUTH_API: live-verified working (register/login/session,
 * a real browser, a real backend, a real cookie) — see this session's
 * own record for the proof, not just an assumption.
 * VITE_REAL_CATALOG_API: also live-verified working as of this same
 * session (real 24-product catalog, real categories, correct HTTP
 * caching via 304s — proven in a real browser, not assumed from review
 * alone).
 * VITE_REAL_REVIEWS_API: code written and reviewed the same way as the
 * two above, but NOT yet live-verified in a real browser — say so
 * plainly rather than imply the same confidence level.
 * VITE_REAL_ADDRESSES_API: unlike cart/wishlist, addressStore.ts already
 * called the real service layer for every operation before this flag
 * existed — this domain needed zero store code changes, just this
 * exclusion plus the matching proxy rule. Not yet live-verified.
 */
const domainFlags: { flag: string; handlers: typeof authHandlers }[] = [
  { flag: 'VITE_REAL_AUTH_API', handlers: authHandlers },
  { flag: 'VITE_REAL_CATALOG_API', handlers: catalogHandlers },
  { flag: 'VITE_REAL_REVIEWS_API', handlers: reviewsHandlers },
  { flag: 'VITE_REAL_ADDRESSES_API', handlers: addressHandlers },
  { flag: 'VITE_REAL_ORDERS_API', handlers: trackingHandlers },
];

const excludedHandlers = domainFlags
  .filter((d) => import.meta.env[d.flag] === 'true')
  .flatMap((d) => d.handlers);

const activeHandlers = excludedHandlers.length > 0 ? handlers.filter((h) => !excludedHandlers.includes(h)) : handlers;

export const worker = setupWorker(...activeHandlers);
