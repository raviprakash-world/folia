import type { AxiosError } from 'axios';
import { apiClient } from './apiClient';
import { isFarRegion } from '@/utils/region';

const ESTIMATE_DELAY_MS = 450;
const FREE_SHIPPING_THRESHOLD = 75;
const useRealShippingApi = import.meta.env.VITE_REAL_SHIPPING_API === 'true';

export class ShippingError extends Error {}

export interface ShippingRate {
  cost: number;
  etaDays: string;
}

/**
 * Cost is a flat rate keyed off the PIN code's first digit as a rough
 * region proxy (src/utils/region.ts — shared with the checkout delivery
 * step and address book, so this heuristic exists in exactly one place),
 * unless the order already clears the free-shipping threshold. This is
 * the fallback heuristic only (Phase 5) when VITE_REAL_SHIPPING_API is on
 * — the real path (estimateShippingRateReal) tries a real Shiprocket
 * serviceability/rate check first; this mock mirrors the backend's own
 * fallback (ShippingService.heuristicEstimate) exactly for when the real
 * flag is off entirely.
 */
async function estimateShippingRateLocal(pincode: string, subtotal: number): Promise<ShippingRate> {
  await new Promise((resolve) => setTimeout(resolve, ESTIMATE_DELAY_MS));

  if (!/^\d{6}$/.test(pincode)) {
    throw new ShippingError('Enter a 6-digit PIN code.');
  }

  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return { cost: 0, etaDays: '3–5 business days' };
  }

  const farRegion = isFarRegion(pincode);
  return {
    cost: farRegion ? 9.5 : 6.5,
    etaDays: farRegion ? '4–6 business days' : '2–4 business days',
  };
}

/** Same real-error-message-passthrough reasoning as couponService.ts's validateCouponReal — checked directly against apps/api/src/shipping/shipping.service.ts's own doc comment before writing this. The real endpoint tries an actual Shiprocket serviceability/rate check first and only falls back to the same heuristic above when Shiprocket isn't configured or fails — see that file's doc comment. */
async function estimateShippingRateReal(pincode: string, subtotal: number): Promise<ShippingRate> {
  try {
    const { data } = await apiClient.post<ShippingRate>('/shipping/estimate', { pincode, subtotal });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new ShippingError(axiosError.response?.data?.message ?? 'Enter a 6-digit PIN code.');
  }
}

export async function estimateShippingRate(pincode: string, subtotal: number): Promise<ShippingRate> {
  return useRealShippingApi ? estimateShippingRateReal(pincode, subtotal) : estimateShippingRateLocal(pincode, subtotal);
}
