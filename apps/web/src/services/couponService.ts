import type { AxiosError } from 'axios';
import { apiClient } from './apiClient';
import { coupons } from '@/data/coupons';
import type { Coupon } from '@/types/cart';

const VALIDATION_DELAY_MS = 500;
const useRealCouponsApi = import.meta.env.VITE_REAL_COUPONS_API === 'true';

export class CouponError extends Error {}

async function validateCouponLocal(code: string, subtotal: number): Promise<Coupon> {
  await new Promise((resolve) => setTimeout(resolve, VALIDATION_DELAY_MS));

  const normalized = code.trim().toUpperCase();
  const coupon = coupons.find((c) => c.code === normalized);

  if (!coupon) {
    throw new CouponError("That code isn't valid.");
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    const remainder = (coupon.minSubtotal - subtotal).toFixed(2);
    throw new CouponError(`This code needs a $${coupon.minSubtotal} subtotal — add $${remainder} more.`);
  }

  return coupon;
}

/**
 * The real backend's error messages are a deliberate byte-for-byte match
 * to this file's own local ones (checked directly against
 * apps/api/src/coupons/coupons.service.ts's own doc comment before
 * writing this) — so re-throwing as CouponError with the real message
 * means cartStore.ts's error handling needs zero changes regardless of
 * which path is active.
 */
async function validateCouponReal(code: string, subtotal: number): Promise<Coupon> {
  try {
    const { data } = await apiClient.post<Coupon>('/coupons/validate', { code, subtotal });
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ message?: string }>;
    throw new CouponError(axiosError.response?.data?.message ?? "That code isn't valid.");
  }
}

export async function validateCoupon(code: string, subtotal: number): Promise<Coupon> {
  return useRealCouponsApi ? validateCouponReal(code, subtotal) : validateCouponLocal(code, subtotal);
}
