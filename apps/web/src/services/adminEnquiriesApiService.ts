import { apiClient } from './apiClient';

export type EnquiryStatus = 'NEW' | 'HANDLED';
export type EnquiryType = 'GENERAL' | 'GARDENING_SERVICE' | 'CORPORATE_GIFTING';

export interface AdminEnquiry {
  id: string;
  type: EnquiryType;
  status: EnquiryStatus;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  details: Record<string, string | number> | null;
  createdAt: string;
}

export interface AdminEnquiriesResponse {
  items: AdminEnquiry[];
  total: number;
}

// --- apps/api/src/enquiries/enquiries.controller.ts ---

export async function fetchAdminEnquiries(status: EnquiryStatus, page = 1, pageSize = 20): Promise<AdminEnquiriesResponse> {
  const { data } = await apiClient.get<AdminEnquiriesResponse>('/admin/enquiries', { params: { status, page, pageSize } });
  return data;
}

export async function markEnquiryHandled(id: string): Promise<void> {
  await apiClient.post(`/admin/enquiries/${id}/handled`);
}
