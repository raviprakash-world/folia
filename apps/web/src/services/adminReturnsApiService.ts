import { apiClient } from './apiClient';
import type { AdminReturnClaim, ReturnClaimStatus } from '@/types/returnClaim';

// --- Return/DOA claims (apps/api/src/admin/admin-returns.controller.ts) ---

export interface AdminReturnsListResponse {
  items: AdminReturnClaim[];
  total: number;
}

export async function fetchAdminReturns(
  status: ReturnClaimStatus = 'pending',
  page = 1,
  pageSize = 20
): Promise<AdminReturnsListResponse> {
  const { data } = await apiClient.get<AdminReturnsListResponse>('/admin/returns', {
    params: { status, page, pageSize },
  });
  return data;
}

export async function fetchAdminReturnClaim(id: string): Promise<AdminReturnClaim> {
  const { data } = await apiClient.get<AdminReturnClaim>(`/admin/returns/${id}`);
  return data;
}

export interface ApproveReturnClaimInput {
  note?: string;
  /** Only valid for a doa-claim claimType — see ReturnsService.adminApprove. */
  resolutionType?: 'REPLACEMENT';
  requiresReverseLogistics?: boolean;
}

export async function approveAdminReturnClaim(id: string, input: ApproveReturnClaimInput): Promise<AdminReturnClaim> {
  const { data } = await apiClient.post<AdminReturnClaim>(`/admin/returns/${id}/approve`, input);
  return data;
}

export async function rejectAdminReturnClaim(id: string, reason: string): Promise<AdminReturnClaim> {
  const { data } = await apiClient.post<AdminReturnClaim>(`/admin/returns/${id}/reject`, { reason });
  return data;
}

/** No body — resolution type/amount are derived entirely server-side (see ReturnsService.resolveClaim). */
export async function resolveAdminReturnClaim(id: string): Promise<AdminReturnClaim> {
  const { data } = await apiClient.post<AdminReturnClaim>(`/admin/returns/${id}/resolve`);
  return data;
}

/** No body — the timestamp is simply "now" (see ReturnsService.markItemReceived). */
export async function markAdminReturnItemReceived(id: string): Promise<AdminReturnClaim> {
  const { data } = await apiClient.post<AdminReturnClaim>(`/admin/returns/${id}/mark-item-received`);
  return data;
}
