import { apiClient } from './apiClient';
import type { CourierId, TrackingStage } from '@/types/order';

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
  courierId: CourierId;
  trackingNumber: string;
  currentLocation: string;
  progressPercent: number;
  stages: TrackingStageEvent[];
  isDelayed: boolean;
  delayHours: number | null;
  estimatedWindowStart: string;
  estimatedWindowEnd: string;
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
