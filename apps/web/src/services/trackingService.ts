import { apiClient } from './apiClient';
import type { TrackingStage } from '@/types/order';

export interface TrackingStageEvent {
  stage: TrackingStage;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
}

export interface ProofOfDelivery {
  deliveredTo: string;
  signedBy: string;
  method: 'signature' | 'left at door' | 'handed to recipient';
  note: string;
}

export interface OrderTracking {
  orderId: string;
  /** Null until an admin actually ships the order (Phase 5) — real fulfillment now happens after checkout, not at it. Free text once set — any real courier name a real aggregator returns, not one of a fixed set. */
  courierId: string | null;
  trackingNumber: string | null;
  /** A real, direct link to the shipment's tracking page on the courier/aggregator's own site, when the provider returns one. Always null pre-shipment and in mock mode. */
  trackingUrl: string | null;
  currentLocation: string | null;
  progressPercent: number;
  stages: TrackingStageEvent[];
  isDelayed: boolean;
  delayHours: number | null;
  estimatedWindowStart: string | null;
  estimatedWindowEnd: string | null;
  proofOfDelivery: ProofOfDelivery | null;
}

export interface FetchTrackingParams {
  placedAt: string;
  windowHours: number;
  destinationCity: string;
  frozenAt?: string;
}

export async function fetchOrderTracking(orderId: string, params: FetchTrackingParams): Promise<OrderTracking> {
  const { data } = await apiClient.get<OrderTracking>(`/orders/${orderId}/tracking`, {
    params: {
      placedAt: params.placedAt,
      windowHours: params.windowHours,
      destinationCity: params.destinationCity,
      ...(params.frozenAt ? { frozenAt: params.frozenAt } : {}),
    },
  });
  return data;
}
