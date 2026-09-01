import { Injectable } from '@nestjs/common';
import { hashOrderId } from '../orders/order-id.util';
import {
  TRACKING_STAGE_DEFS,
  deliveryWindowHours,
  stagePublicName,
} from './tracking.types';
import type { DeliveryMethodType } from '../orders/order.types';

const HUB_CITIES = ['Sacramento, CA', 'Reno, NV', 'Boise, ID'];
const DELIVERY_LOCATIONS = [
  'front door',
  'building lobby',
  'mailroom',
  'side entrance',
];
const SIGNATURE_NAMES = ['S. Rivera', 'A. Chen', 'M. Osei', 'J. Park'];

export interface TrackingInput {
  orderId: string;
  placedAt: Date;
  deliveryMethod: DeliveryMethodType;
  destinationCity: string;
  /** Already in the frontend's public display format (e.g. "swiftpost"), not the DB enum — this service only echoes it into the response, never branches on it. */
  courierId: string;
  trackingNumber: string;
  /** Set once an order is cancelled/returned — freezes the simulation at that moment rather than letting it keep "progressing" after the order is no longer actually in transit. */
  frozenAt?: Date;
}

/**
 * Ported directly from apps/web/src/mocks/trackingHandlers.ts — same
 * deterministic-per-order-id delay simulation, same stage-progression
 * math, same proof-of-delivery generation. Pure computation: the only
 * "state" involved is the order's own placedAt/deliveryMethod/status,
 * which the caller (OrdersService) already has — nothing here touches
 * Prisma directly, and nothing about tracking progress is itself stored;
 * it's recomputed fresh on every read from elapsed real time, exactly as
 * the frontend's mock already does.
 */
@Injectable()
export class TrackingService {
  simulate(input: TrackingInput) {
    const seed = hashOrderId(input.orderId);

    // Deterministic occasional delay — about 1 in 6 orders, not truly
    // random per request, so refreshing doesn't toggle it.
    const isDelayed = seed % 6 === 0;
    const delayHours = isDelayed ? 6 + (seed % 12) : 0;
    const windowHours = deliveryWindowHours(input.deliveryMethod);
    const effectiveWindowHours = windowHours + delayHours;

    const evaluateAt = input.frozenAt ?? new Date();
    const elapsedHours =
      (evaluateAt.getTime() - input.placedAt.getTime()) / (1000 * 60 * 60);
    const progressFraction = Math.max(
      0,
      Math.min(1, elapsedHours / effectiveWindowHours),
    );

    const stageCount = TRACKING_STAGE_DEFS.length;
    const completedCount = Math.min(
      stageCount,
      Math.floor(progressFraction * stageCount) + 1,
    );

    const stages = TRACKING_STAGE_DEFS.map((def, i) => {
      const completed = i < completedCount;
      const stageFraction = i / (stageCount - 1);
      const timestamp = completed
        ? new Date(
            input.placedAt.getTime() +
              stageFraction * effectiveWindowHours * 60 * 60 * 1000,
          ).toISOString()
        : null;
      return {
        stage: stagePublicName(def.stage),
        label: def.label,
        description: def.description,
        completed,
        timestamp,
      };
    });

    const currentStageIndex = Math.min(completedCount - 1, stageCount - 1);
    const currentLocation =
      currentStageIndex >= stageCount - 2
        ? `Near ${input.destinationCity}`
        : currentStageIndex <= 1
          ? 'Origin facility, Portland, OR'
          : (HUB_CITIES[currentStageIndex % HUB_CITIES.length] ??
            HUB_CITIES[0]);

    const delivered = stages[stageCount - 1]?.completed ?? false;
    const proofOfDelivery = delivered
      ? {
          deliveredTo: DELIVERY_LOCATIONS[seed % DELIVERY_LOCATIONS.length],
          signedBy: SIGNATURE_NAMES[seed % SIGNATURE_NAMES.length],
          method:
            seed % 3 === 0
              ? 'signature'
              : seed % 3 === 1
                ? 'left at door'
                : 'handed to recipient',
          note: 'Mock proof of delivery — no real courier integration exists behind this record.',
        }
      : null;

    const windowStart = new Date(
      input.placedAt.getTime() + effectiveWindowHours * 0.85 * 60 * 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      input.placedAt.getTime() + effectiveWindowHours * 1.15 * 60 * 60 * 1000,
    ).toISOString();

    return {
      orderId: input.orderId,
      courierId: input.courierId,
      trackingNumber: input.trackingNumber,
      currentLocation,
      progressPercent: Math.round((completedCount / stageCount) * 100),
      stages,
      isDelayed,
      delayHours: isDelayed ? delayHours : null,
      estimatedWindowStart: windowStart,
      estimatedWindowEnd: windowEnd,
      proofOfDelivery,
    };
  }
}
