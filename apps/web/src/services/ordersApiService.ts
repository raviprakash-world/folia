import { apiClient } from './apiClient';
import type {
  Order,
  DeliveryMethodType,
  PaymentMethodType,
  CancellationReason,
  ReturnReason,
} from '@/types/order';
import type { CreatePaymentResult } from './paymentsApiService';

/** Phase 1 (payments) — checkout() no longer returns a fully-paid order synchronously; it returns the order (in 'pending-payment' for a gateway method, 'processing' for COD) plus everything needed to actually resolve payment client-side. */
export type CheckoutResponse = Order & { payment: CreatePaymentResult };

export interface CheckoutRequest {
  shippingAddressId: string;
  billingAddressId: string;
  deliveryMethod: DeliveryMethodType;
  paymentMethod: PaymentMethodType;
  paymentDisplayLabel: string;
  couponCode?: string;
  customerNotes?: string;
}

/**
 * idempotencyKey is passed as a header, not a body field — matches the
 * real backend's contract exactly (Phase 11: Idempotency-Key header,
 * checked against a real (userId, idempotencyKey) unique constraint
 * before doing any cart/payment/inventory work). Genuinely defends
 * against double-submission on a network retry, not just the disabled-
 * button UI guard this page already has.
 */
export async function checkoutReal(request: CheckoutRequest, idempotencyKey: string): Promise<CheckoutResponse> {
  const { data } = await apiClient.post<CheckoutResponse>('/checkout', request, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return data;
}

export async function fetchRealOrders(): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/orders');
  return data;
}

export async function fetchRealOrder(id: string): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/orders/${id}`);
  return data;
}

export async function cancelRealOrder(id: string, reason: CancellationReason, note?: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/orders/${id}/cancel`, { reason, note });
  return data;
}

export async function requestRealReturn(id: string, reason: ReturnReason, note?: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/orders/${id}/return`, { reason, note });
  return data;
}

export async function fetchRealTracking(id: string): Promise<unknown> {
  const { data } = await apiClient.get<unknown>(`/orders/${id}/tracking`);
  return data;
}

export async function updateRealOrderNotes(id: string, notes: string): Promise<Order> {
  const { data } = await apiClient.patch<Order>(`/orders/${id}/notes`, { notes });
  return data;
}

export async function reorderReal(id: string): Promise<{ added: number; skipped: number }> {
  const { data } = await apiClient.post<{ added: number; skipped: number }>(`/orders/${id}/reorder`);
  return data;
}
