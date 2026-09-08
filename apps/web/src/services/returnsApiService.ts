import axios from 'axios';
import { apiClient } from './apiClient';
import type { MyReturnClaim, ReturnClaim, ReturnClaimItemInput, ReturnClaimReason } from '@/types/returnClaim';

export interface CreateReturnClaimInput {
  items: ReturnClaimItemInput[];
  reason: ReturnClaimReason;
  note?: string;
  evidence: File[];
}

/**
 * multipart/form-data, matching apps/api/src/orders/orders.controller.ts's
 * createReturnClaim exactly: `items` as a JSON-encoded string field (a
 * multipart field has no concept of nested structures), evidence files
 * under the `evidence` field name. Content-Type is deliberately left for
 * axios to set itself (it detects the FormData body and sets the
 * multipart boundary automatically) — apiClient's default
 * 'Content-Type: application/json' header only applies when a call
 * doesn't override it, and axios's FormData handling does exactly that.
 */
export async function createReturnClaim(orderId: string, input: CreateReturnClaimInput): Promise<ReturnClaim> {
  const formData = new FormData();
  formData.append('items', JSON.stringify(input.items));
  formData.append('reason', input.reason);
  if (input.note) formData.append('note', input.note);
  input.evidence.forEach((file) => formData.append('evidence', file));

  const { data } = await apiClient.post<ReturnClaim>(`/orders/${orderId}/returns`, formData);
  return data;
}

/**
 * Most orders have no claim at all — that's the ordinary case, not an
 * error, so a 404 here becomes `null` rather than a thrown/rejected
 * query. Any other failure (auth, 500, network) still propagates.
 */
export async function fetchMyReturnClaim(orderId: string): Promise<MyReturnClaim | null> {
  try {
    const { data } = await apiClient.get<MyReturnClaim>(`/orders/${orderId}/returns`);
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
