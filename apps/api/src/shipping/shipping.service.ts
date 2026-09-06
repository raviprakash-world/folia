import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { isFarRegion } from './region.util';
import {
  SHIPPING_PROVIDER,
  type ShippingProviderClient,
} from './providers/shipping-provider.interface';

const FREE_SHIPPING_THRESHOLD = 75;
const NEAR_REGION_COST = 6.5;
const FAR_REGION_COST = 9.5;
/** No real per-order weight catalog exists (see apps/web/src/utils/packageDetails.ts) — a single reasonable placeholder, same reasoning as ShiprocketProvider.createShipment's placeholder parcel dimensions. */
const DEFAULT_ESTIMATE_WEIGHT_KG = 1;

export interface ShippingEstimate {
  cost: number;
  etaDays: string;
}

/**
 * Tries a real Shiprocket serviceability/rate check first (Phase 5);
 * falls back to the flat-rate heuristic (mirrors
 * apps/web/src/services/shippingService.ts's local mock exactly) when
 * Shiprocket isn't configured or the call fails for any reason. This is
 * a public, unauthenticated, constantly-hit cart-page endpoint — it must
 * never 500 just because no courier account exists yet or Shiprocket is
 * briefly unreachable, unlike an explicit admin "ship this order" action
 * (see ShiprocketProvider's own doc comment for why that one does NOT
 * get this same graceful-degradation treatment).
 */
@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    @Inject(SHIPPING_PROVIDER)
    private readonly shippingProvider: ShippingProviderClient,
  ) {}

  async estimate(pincode: string, subtotal: number): Promise<ShippingEstimate> {
    if (!/^\d{6}$/.test(pincode)) {
      throw new BadRequestException('Enter a 6-digit PIN code.');
    }

    const real = await this.tryRealEstimate(pincode, subtotal);
    if (real) return real;

    return this.heuristicEstimate(pincode, subtotal);
  }

  private async tryRealEstimate(
    pincode: string,
    subtotal: number,
  ): Promise<ShippingEstimate | null> {
    try {
      const result = await this.shippingProvider.checkServiceability({
        pickupPincode: pincode,
        deliveryPincode: pincode,
        orderValue: subtotal,
        isCod: false,
        weightKg: DEFAULT_ESTIMATE_WEIGHT_KG,
      });
      if (!result.serviceable) return null;

      const cheapest = [...result.couriers].sort((a, b) => a.rate - b.rate)[0];
      if (!cheapest) return null;

      const cost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : cheapest.rate;
      return { cost, etaDays: cheapest.etaDays };
    } catch (error) {
      this.logger.warn(
        `Real shipping estimate unavailable, falling back to the flat-rate heuristic: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private heuristicEstimate(
    pincode: string,
    subtotal: number,
  ): ShippingEstimate {
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      return { cost: 0, etaDays: '3–5 business days' };
    }

    const farRegion = isFarRegion(pincode);
    return {
      cost: farRegion ? FAR_REGION_COST : NEAR_REGION_COST,
      etaDays: farRegion ? '4–6 business days' : '2–4 business days',
    };
  }
}
