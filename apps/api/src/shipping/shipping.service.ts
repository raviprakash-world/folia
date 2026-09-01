import { BadRequestException, Injectable } from '@nestjs/common';
import { isFarRegion } from './region.util';

const FREE_SHIPPING_THRESHOLD = 75;
const NEAR_REGION_COST = 6.5;
const FAR_REGION_COST = 9.5;

export interface ShippingEstimate {
  cost: number;
  etaDays: string;
}

/** Mirrors apps/web/src/services/shippingService.ts's estimateShippingRate exactly. */
@Injectable()
export class ShippingService {
  estimate(zip: string, subtotal: number): ShippingEstimate {
    if (!/^\d{5}$/.test(zip)) {
      throw new BadRequestException('Enter a 5-digit ZIP code.');
    }

    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
      return { cost: 0, etaDays: '3–5 business days' };
    }

    const farRegion = isFarRegion(zip);
    return {
      cost: farRegion ? FAR_REGION_COST : NEAR_REGION_COST,
      etaDays: farRegion ? '4–6 business days' : '2–4 business days',
    };
  }
}
