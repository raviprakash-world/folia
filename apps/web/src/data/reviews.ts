import catalog from '../../../api/prisma/demo/catalog.json';
import type { Review } from '@/types/product';

/** Mock reviews served by MSW's /api/reviews handler — fictional demo reviews from apps/api/prisma/demo/catalog.json (see products.ts). */
export const reviews: Review[] = catalog.reviews.map((r, i) => ({
  id: `r${i + 1}`,
  productId: r.productId,
  author: r.author,
  rating: r.rating as Review['rating'],
  title: r.title,
  body: r.body,
  date: r.date,
  verified: r.verified,
}));
