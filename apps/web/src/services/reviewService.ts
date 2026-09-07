import { apiClient } from './apiClient';
import { extractApiErrorMessage } from '@/utils/apiError';
import type { Review } from '@/types/product';

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data } = await apiClient.get<Review[]>('/reviews', { params: { productId } });
  return data;
}

export interface CreateReviewInput {
  productId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
}

/** Marketplace Phase 16 — the backend's own eligibility gate (a DELIVERED order containing this product) surfaces as a real 400 ("You can only review a product from a delivered order."); an already-reviewed product surfaces as a real 409 ("You have already reviewed this product."). Both re-thrown with their real backend message, not swallowed into a generic one. */
export async function createReview(input: CreateReviewInput): Promise<Review> {
  try {
    const { data } = await apiClient.post<Review>('/reviews', input);
    return data;
  } catch (error) {
    throw new Error(extractApiErrorMessage(error, "Couldn't submit your review — please try again."), {
      cause: error,
    });
  }
}
