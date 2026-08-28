import { isAxiosError } from 'axios';
import { apiClient } from './apiClient';

export class NewsletterError extends Error {
  isDuplicate: boolean;
  constructor(message: string, isDuplicate: boolean) {
    super(message);
    this.isDuplicate = isDuplicate;
  }
}

export async function subscribeToNewsletter(email: string): Promise<void> {
  try {
    await apiClient.post('/newsletter/subscribe', { email });
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 409) {
      throw new NewsletterError("You're already on the list.", true);
    }
    throw new NewsletterError('Something went wrong — try again in a moment.', false);
  }
}
