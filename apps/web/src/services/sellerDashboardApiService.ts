import { apiClient } from './apiClient';
import type { AxiosError } from 'axios';
import type {
  SellerProfile,
  SellerAddress,
  SellerProduct,
  SellerProductInput,
  UpdateSellerProductInput,
  SellerOrderGroup,
  SellerLedgerEntry,
  SellerPayout,
  SellerVerification,
} from '@/types/sellerDashboard';

/** Every seller-dashboard endpoint (apps/api/src/sellers/*, payouts/seller-earnings.controller.ts) proxied under /api/sellers — see vite.config.ts's existing VITE_REAL_SELLERS_API-gated entry. */

function friendlyError(error: unknown, fallback: string): Error {
  const axiosError = error as AxiosError<{ message?: string }>;
  const message = axiosError.response?.data?.message;
  return new Error(Array.isArray(message) ? message.join(' ') : message ?? fallback, { cause: error });
}

// --- Application / profile ---

export interface ApplyAsSellerInput {
  displayName: string;
  description: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone: string;
  address: SellerAddress;
}

export async function applyAsSeller(input: ApplyAsSellerInput): Promise<SellerProfile> {
  try {
    const { data } = await apiClient.post<SellerProfile>('/sellers/apply', input);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not submit your seller application.');
  }
}

export async function fetchSellerProfile(): Promise<SellerProfile> {
  const { data } = await apiClient.get<SellerProfile>('/sellers/me');
  return data;
}

export async function updateSellerProfile(input: Partial<ApplyAsSellerInput>): Promise<SellerProfile> {
  try {
    const { data } = await apiClient.patch<SellerProfile>('/sellers/me', input);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not save your profile changes.');
  }
}

// --- Verification documents ---

export async function fetchSellerVerifications(): Promise<SellerVerification[]> {
  const { data } = await apiClient.get<SellerVerification[]>('/sellers/me/verifications');
  return data;
}

/** Returns only the newly created records (apps/api/src/sellers/sellers.service.ts's uploadVerification), not the full list — callers refetch the list rather than trying to merge this in. */
export async function uploadSellerVerification(documentType: string, files: File[]): Promise<SellerVerification[]> {
  const form = new FormData();
  form.append('documentType', documentType);
  files.forEach((file) => form.append('files', file));
  try {
    const { data } = await apiClient.post<SellerVerification[]>('/sellers/me/verifications', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not upload that document.');
  }
}

// --- Products ---

export async function fetchSellerProducts(): Promise<SellerProduct[]> {
  const { data } = await apiClient.get<SellerProduct[]>('/sellers/me/products');
  return data;
}

export async function fetchSellerProduct(id: string): Promise<SellerProduct> {
  const { data } = await apiClient.get<SellerProduct>(`/sellers/me/products/${id}`);
  return data;
}

export async function createSellerProduct(input: SellerProductInput): Promise<SellerProduct> {
  try {
    const { data } = await apiClient.post<SellerProduct>('/sellers/me/products', input);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not create this product.');
  }
}

export async function updateSellerProduct(id: string, input: UpdateSellerProductInput): Promise<SellerProduct> {
  try {
    const { data } = await apiClient.patch<SellerProduct>(`/sellers/me/products/${id}`, input);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not save this product.');
  }
}

export async function submitSellerProduct(id: string): Promise<SellerProduct> {
  try {
    const { data } = await apiClient.post<SellerProduct>(`/sellers/me/products/${id}/submit`);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not submit this product for review.');
  }
}

export async function archiveSellerProduct(id: string): Promise<SellerProduct> {
  try {
    const { data } = await apiClient.post<SellerProduct>(`/sellers/me/products/${id}/archive`);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not archive this product.');
  }
}

export async function uploadSellerProductMedia(id: string, files: File[]): Promise<SellerProduct> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  try {
    const { data } = await apiClient.post<SellerProduct>(`/sellers/me/products/${id}/media`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not upload image.');
  }
}

export async function deleteSellerProductMedia(id: string, imageId: string): Promise<SellerProduct> {
  try {
    const { data } = await apiClient.delete<SellerProduct>(`/sellers/me/products/${id}/media/${imageId}`);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Could not remove this image.');
  }
}

// --- Orders ---

export interface SellerOrdersListResponse {
  items: SellerOrderGroup[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchSellerOrders(
  status?: string,
  page = 1,
  pageSize = 20
): Promise<SellerOrdersListResponse> {
  const { data } = await apiClient.get<SellerOrdersListResponse>('/sellers/me/orders', {
    params: { status, page, pageSize },
  });
  return data;
}

export async function fetchSellerOrder(id: string): Promise<SellerOrderGroup> {
  const { data } = await apiClient.get<SellerOrderGroup>(`/sellers/me/orders/${id}`);
  return data;
}

export async function updateSellerOrderNote(id: string, note: string): Promise<SellerOrderGroup> {
  const { data } = await apiClient.patch<SellerOrderGroup>(`/sellers/me/orders/${id}/note`, { note });
  return data;
}

export async function shipSellerOrder(id: string): Promise<SellerOrderGroup> {
  try {
    const { data } = await apiClient.post<SellerOrderGroup>(`/sellers/me/orders/${id}/ship`);
    return data;
  } catch (error) {
    throw friendlyError(error, 'Shipment failed.');
  }
}

// --- Earnings ---

export async function fetchSellerBalance(): Promise<number> {
  const { data } = await apiClient.get<{ balance: number }>('/sellers/me/balance');
  return data.balance;
}

export interface SellerLedgerResponse {
  items: SellerLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function fetchSellerLedger(page = 1, pageSize = 20): Promise<SellerLedgerResponse> {
  const { data } = await apiClient.get<SellerLedgerResponse>('/sellers/me/ledger', {
    params: { page, pageSize },
  });
  return data;
}

export async function fetchSellerPayouts(): Promise<SellerPayout[]> {
  const { data } = await apiClient.get<SellerPayout[]>('/sellers/me/payouts');
  return data;
}
