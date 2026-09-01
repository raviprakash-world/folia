import { http, HttpResponse, delay } from 'msw';
import { trackingStages } from '@/data/trackingStages';
import { assignCourier, generateTrackingNumber, hashOrderId } from '@/utils/tracking';
import type { TrackingStage } from '@/types/order';

const TRACKING_DELAY_MS = 350;

const hubCities = ['Sacramento, CA', 'Reno, NV', 'Boise, ID'];
const deliveryLocations = ['front door', 'building lobby', 'mailroom', 'side entrance'];
const signatureNames = ['S. Rivera', 'A. Chen', 'M. Osei', 'J. Park'];

interface StageEvent {
  stage: TrackingStage;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
}

interface ProofOfDelivery {
  deliveredTo: string;
  signedBy: string;
  method: 'signature' | 'left at door' | 'handed to recipient';
  note: string;
}

export const trackingHandlers = [
  http.get('/api/orders/:id/tracking', async ({ request, params }) => {
    await delay(TRACKING_DELAY_MS);

    const orderId = params.id as string;
    const url = new URL(request.url);
    const placedAt = url.searchParams.get('placedAt');
    const windowHours = Number(url.searchParams.get('windowHours') ?? '96');
    const destinationCity = url.searchParams.get('destinationCity') ?? 'your area';
    const frozenAt = url.searchParams.get('frozenAt'); // set once an order is cancelled/returned

    if (!placedAt) {
      return HttpResponse.json({ message: 'Missing placedAt.' }, { status: 400 });
    }

    const seed = hashOrderId(orderId);

    // Deterministic occasional delay — about 1 in 6 orders, not truly
    // random per request, so refreshing the page doesn't toggle it.
    const isDelayed = seed % 6 === 0;
    const delayHours = isDelayed ? 6 + (seed % 12) : 0;
    const effectiveWindowHours = windowHours + delayHours;

    const placedDate = new Date(placedAt);
    const evaluateAt = frozenAt ? new Date(frozenAt) : new Date();
    const elapsedHours = (evaluateAt.getTime() - placedDate.getTime()) / (1000 * 60 * 60);
    const progressFraction = Math.max(0, Math.min(1, elapsedHours / effectiveWindowHours));

    const courierId = assignCourier(orderId);
    const trackingNumber = generateTrackingNumber(orderId, courierId);

    const stageCount = trackingStages.length;
    const completedCount = Math.min(stageCount, Math.floor(progressFraction * stageCount) + 1);

    const stages: StageEvent[] = trackingStages.map((def, i) => {
      const completed = i < completedCount;
      const stageFraction = i / (stageCount - 1);
      const timestamp = completed
        ? new Date(placedDate.getTime() + stageFraction * effectiveWindowHours * 60 * 60 * 1000).toISOString()
        : null;
      return { ...def, completed, timestamp };
    });

    const currentStageIndex = Math.min(completedCount - 1, stageCount - 1);
    const currentLocation =
      currentStageIndex >= stageCount - 2
        ? `Near ${destinationCity}`
        : currentStageIndex <= 1
          ? 'Origin facility, Portland, OR'
          : (hubCities[currentStageIndex % hubCities.length] ?? hubCities[0]!);

    const delivered = stages[stageCount - 1]?.completed ?? false;
    const proofOfDelivery: ProofOfDelivery | null = delivered
      ? {
          deliveredTo: deliveryLocations[seed % deliveryLocations.length]!,
          signedBy: signatureNames[seed % signatureNames.length]!,
          method: seed % 3 === 0 ? 'signature' : seed % 3 === 1 ? 'left at door' : 'handed to recipient',
          note: 'Mock proof of delivery — no real courier integration exists behind this record.',
        }
      : null;

    const windowStart = new Date(placedDate.getTime() + effectiveWindowHours * 0.85 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(placedDate.getTime() + effectiveWindowHours * 1.15 * 60 * 60 * 1000).toISOString();

    return HttpResponse.json({
      orderId,
      courierId,
      trackingNumber,
      currentLocation,
      progressPercent: Math.round((completedCount / stageCount) * 100),
      stages,
      isDelayed,
      delayHours: isDelayed ? delayHours : null,
      estimatedWindowStart: windowStart,
      estimatedWindowEnd: windowEnd,
      proofOfDelivery,
    });
  }),
];
