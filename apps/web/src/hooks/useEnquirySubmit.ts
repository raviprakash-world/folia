import { useState } from 'react';
import { isAxiosError } from 'axios';
import { submitEnquiry } from '@/services/enquiryService';
import type { EnquiryPayload } from '@/services/enquiryService';

const FALLBACK = 'Something went wrong sending your enquiry. Please try again in a moment.';

export function useEnquirySubmit() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  /** Resolves true when the enquiry was saved. */
  async function send(payload: EnquiryPayload): Promise<boolean> {
    setStatus('idle');
    try {
      await submitEnquiry(payload);
      setStatus('success');
      return true;
    } catch (error) {
      const serverMessage = isAxiosError<{ message?: string | string[] }>(error) ? error.response?.data.message : undefined;
      setErrorMessage((Array.isArray(serverMessage) ? serverMessage[0] : serverMessage) ?? FALLBACK);
      setStatus('error');
      return false;
    }
  }

  return { status, errorMessage, send };
}
