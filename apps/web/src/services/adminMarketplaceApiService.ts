import { apiClient } from './apiClient';
import { extractApiErrorMessage } from '@/utils/apiError';
import type {
  AdminSellerRecord,
  AdminSellerProductRecord,
  AdminCommissionsResult,
  AdminPayoutDetail,
  MarketplaceAnalytics,
} from '@/types/adminMarketplace';
import type { SellerLedgerEntry, SellerPayout } from '@/types/sellerDashboard';

function friendlyError(error: unknown, fallback: string): Error {
  return new Error(extractApiErrorMessage(error, fallback), { cause: error });
}

// --- Marketplace analytics (apps/api/src/analytics/analytics.controller.ts) ---

export async function fetchMarketplaceAnalytics(): Promise<MarketplaceAnalytics> {
  const { data } = await apiClient.get<MarketplaceAnalytics>('/analytics/marketplace');
  return data;
}

// --- Sellers (apps/api/src/admin/admin-sellers.controller.ts) ---

export type AdminSellerStatusFilter =
  | 'all'
  | 'applied'
  | 'under-review'
  | 'rejected'
  | 'active'
  | 'suspended'
  | 'deactivated';

export interface AdminSellersListResponse {
  items: AdminSellerRecord[];
  total: number;
}

export async function fetchAdminSellers(
  status: AdminSellerStatusFilter,
  page = 1,
  pageSize = 20
): Promise<AdminSellersListResponse> {
  const { data } = await apiClient.get<AdminSellersListResponse>('/admin/sellers', {
    params: { status, page, pageSize },
  });
  return data;
}

export async function fetchAdminSeller(id: string): Promise<AdminSellerRecord> {
  const { data } = await apiClient.get<AdminSellerRecord>(`/admin/sellers/${id}`);
  return data;
}

async function postSellerAction(id: string, action: string, body?: object): Promise<AdminSellerRecord> {
  try {
    const { data } = await apiClient.post<AdminSellerRecord>(`/admin/sellers/${id}/${action}`, body ?? {});
    return data;
  } catch (error) {
    throw friendlyError(error, `Couldn't ${action.replace('-', ' ')} this seller.`);
  }
}

export const approveAdminSeller = (id: string) => postSellerAction(id, 'approve');
export const rejectAdminSeller = (id: string, reason: string) => postSellerAction(id, 'reject', { reason });
export const suspendAdminSeller = (id: string, note?: string) => postSellerAction(id, 'suspend', { note });
export const reactivateAdminSeller = (id: string) => postSellerAction(id, 'reactivate');
export const deactivateAdminSeller = (id: string, note?: string) => postSellerAction(id, 'deactivate', { note });

// --- Seller-submitted products (apps/api/src/admin/admin-seller-products.controller.ts) ---

export type AdminSellerProductStatusFilter = 'all' | 'submitted' | 'under-review' | 'rejected' | 'active' | 'archived';

export interface AdminSellerProductsListResponse {
  items: AdminSellerProductRecord[];
  total: number;
}

export async function fetchAdminSellerProducts(
  status: AdminSellerProductStatusFilter,
  page = 1,
  pageSize = 20
): Promise<AdminSellerProductsListResponse> {
  const { data } = await apiClient.get<AdminSellerProductsListResponse>('/admin/seller-products', {
    params: { status, page, pageSize },
  });
  return data;
}

async function postSellerProductAction(id: string, action: string, body?: object): Promise<AdminSellerProductRecord> {
  try {
    const { data } = await apiClient.post<AdminSellerProductRecord>(`/admin/seller-products/${id}/${action}`, body ?? {});
    return data;
  } catch (error) {
    throw friendlyError(error, `Couldn't ${action.replace('-', ' ')} this product.`);
  }
}

export const approveAdminSellerProduct = (id: string) => postSellerProductAction(id, 'approve');
export const rejectAdminSellerProduct = (id: string, reason: string) => postSellerProductAction(id, 'reject', { reason });
export const requestChangesAdminSellerProduct = (id: string, reason: string) =>
  postSellerProductAction(id, 'request-changes', { reason });
export const deactivateAdminSellerProduct = (id: string) => postSellerProductAction(id, 'deactivate');

// --- Commissions (apps/api/src/admin/admin-commissions.controller.ts) ---

export async function fetchAdminCommissions(): Promise<AdminCommissionsResult> {
  const { data } = await apiClient.get<AdminCommissionsResult>('/admin/commissions');
  return data;
}

export async function setAdminCommissionRate(sellerId: string | null, ratePercent: number): Promise<void> {
  try {
    await apiClient.post('/admin/commissions', { sellerId, ratePercent });
  } catch (error) {
    throw friendlyError(error, "Couldn't set that commission rate.");
  }
}

// --- Payouts / ledger (apps/api/src/admin/admin-payouts.controller.ts) ---

export async function fetchAdminSellerBalance(sellerId: string): Promise<number> {
  const { data } = await apiClient.get<{ balance: number }>(`/admin/sellers/${sellerId}/balance`);
  return data.balance;
}

export interface AdminLedgerListResponse {
  items: SellerLedgerEntry[];
  total: number;
}

export async function fetchAdminSellerLedger(
  sellerId: string,
  page = 1,
  pageSize = 20
): Promise<AdminLedgerListResponse> {
  const { data } = await apiClient.get<AdminLedgerListResponse>(`/admin/sellers/${sellerId}/ledger`, {
    params: { page, pageSize },
  });
  return data;
}

export async function adjustAdminSellerLedger(sellerId: string, amount: number, note: string): Promise<SellerLedgerEntry> {
  try {
    const { data } = await apiClient.post<SellerLedgerEntry>(`/admin/sellers/${sellerId}/ledger-adjustments`, {
      amount,
      note,
    });
    return data;
  } catch (error) {
    throw friendlyError(error, "Couldn't record that adjustment.");
  }
}

export async function initiateAdminPayout(sellerId: string, idempotencyKey: string): Promise<SellerPayout> {
  try {
    const { data } = await apiClient.post<SellerPayout>(
      `/admin/sellers/${sellerId}/payouts`,
      {},
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return data;
  } catch (error) {
    throw friendlyError(error, "Couldn't initiate a payout for this seller.");
  }
}

/** A bare array, not {items, total} — matches AdminPayoutsController.listPayouts exactly (verified directly against a live response, not assumed). */
export async function fetchAdminPayouts(filter: { sellerId?: string; status?: string } = {}): Promise<SellerPayout[]> {
  const { data } = await apiClient.get<SellerPayout[]>('/admin/payouts', { params: filter });
  return data;
}

export async function fetchAdminPayoutDetail(id: string): Promise<AdminPayoutDetail> {
  const { data } = await apiClient.get<AdminPayoutDetail>(`/admin/payouts/${id}`);
  return data;
}

async function postPayoutAction(id: string, action: string, body?: object): Promise<SellerPayout> {
  try {
    const { data } = await apiClient.post<SellerPayout>(`/admin/payouts/${id}/${action}`, body ?? {});
    return data;
  } catch (error) {
    throw friendlyError(error, `Couldn't ${action.replace('-', ' ')} this payout.`);
  }
}

export const markAdminPayoutProcessing = (id: string) => postPayoutAction(id, 'mark-processing');
export const markAdminPayoutPaid = (id: string) => postPayoutAction(id, 'mark-paid');
export const markAdminPayoutFailed = (id: string, failureReason: string) =>
  postPayoutAction(id, 'mark-failed', { failureReason });
export const cancelAdminPayout = (id: string) => postPayoutAction(id, 'cancel');
