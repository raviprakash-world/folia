import { apiClient } from './apiClient';

export interface EnquiryPayload {
  type: 'GENERAL' | 'GARDENING_SERVICE' | 'CORPORATE_GIFTING';
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  city?: string;
  serviceType?: string;
  company?: string;
  quantity?: number;
  occasion?: string;
  neededBy?: string;
}

export async function submitEnquiry(payload: EnquiryPayload): Promise<void> {
  await apiClient.post('/enquiries', payload);
}
