import { http, HttpResponse, delay } from 'msw';
import { reviews } from '@/data/reviews';

const API_DELAY_MS = 350;

/**
 * Phase 14 (backend integration, reviews domain) — extracted from
 * handlers.ts, same reasoning as catalogHandlers.ts: a separate file so
 * this can be selectively excluded from MSW's registered set via its
 * own flag, matching auth's and catalog's already-proven pattern.
 */
export const reviewsHandlers = [
  // GET /api/reviews?productId=
  http.get('/api/reviews', async ({ request }) => {
    await delay(API_DELAY_MS);
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const filtered = productId ? reviews.filter((r) => r.productId === productId) : reviews;
    return HttpResponse.json(filtered);
  }),
];
