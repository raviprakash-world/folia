import { apiClient } from './apiClient';
import type { ContactFormValues } from '@/utils/validation';

export async function submitContactForm(values: ContactFormValues): Promise<void> {
  await apiClient.post('/contact', values);
}
