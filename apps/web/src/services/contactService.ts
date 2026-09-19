import { submitEnquiry } from './enquiryService';
import type { ContactFormValues } from '@/utils/validation';

export async function submitContactForm(values: ContactFormValues): Promise<void> {
  await submitEnquiry({ type: 'GENERAL', ...values });
}
