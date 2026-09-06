import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import type {
  CreateShipmentInput,
  CreatedShipment,
  ServiceabilityInput,
  ServiceabilityResult,
  ShippingProviderClient,
  TrackedShipment,
} from './shipping-provider.interface';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

interface ShiprocketAuthResponse {
  token: string;
}

interface ShiprocketCourierOption {
  courier_name: string;
  rate: number;
  etd: string;
  cod: 0 | 1;
  courier_company_id: number;
}

interface ShiprocketServiceabilityResponse {
  data?: {
    available_courier_companies?: ShiprocketCourierOption[];
  };
}

interface ShiprocketCreateOrderResponse {
  order_id: number;
  shipment_id: number;
}

interface ShiprocketAssignAwbResponse {
  response: {
    data: {
      awb_code: string;
      courier_name: string;
    };
  };
}

interface ShiprocketTrackResponse {
  tracking_data?: {
    shipment_track?: { current_status?: string }[];
    shipment_track_activities?: {
      date: string;
      status: string;
      location?: string;
    }[];
  };
}

/**
 * The one real courier-aggregator integration in this codebase (see
 * docs/API_INTEGRATION_STATUS.md). Shiprocket has no official Node SDK
 * (unlike Razorpay/Resend), so this talks to its REST API directly via
 * the platform's native `fetch` — no new HTTP-client dependency added
 * for one provider.
 *
 * Auth is email/password (not a static API key): a login call returns a
 * bearer token valid for ~10 days, cached in memory and refreshed lazily
 * on first use or after a 401 — never in the constructor, so the app can
 * boot with no SHIPROCKET_EMAIL/PASSWORD configured at all. Every method
 * fails loudly and specifically the moment a real call is actually
 * attempted, matching RazorpayProvider/ResendProvider's established
 * pattern. Unlike payments/email, ShippingService.estimate() wraps
 * checkServiceability in its own try/catch and falls back to the
 * existing flat-rate heuristic — a public, unauthenticated, constantly-hit
 * cart-page endpoint must never break just because no courier account
 * exists yet. createShipment (an explicit admin action) does NOT get
 * that treatment: a "ship this order" click that silently no-ops would
 * be far worse than one that visibly fails.
 */
@Injectable()
export class ShiprocketProvider implements ShippingProviderClient {
  private token: string | null = null;

  constructor(private readonly config: AppConfigService) {}

  private requireConfig(): { email: string; password: string } {
    const email = this.config.shiprocketEmail;
    const password = this.config.shiprocketPassword;
    if (!email || !password) {
      throw new InternalServerErrorException(
        'Shiprocket is not configured — SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD are unset. Real shipments cannot be created until a Shiprocket account exists and its credentials are set (see docs/API_INTEGRATION_STATUS.md).',
      );
    }
    return { email, password };
  }

  private async getToken(forceRefresh = false): Promise<string> {
    if (this.token && !forceRefresh) return this.token;

    const { email, password } = this.requireConfig();
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Shiprocket login failed (${res.status}). Check SHIPROCKET_EMAIL/SHIPROCKET_PASSWORD.`,
      );
    }
    const data = (await res.json()) as ShiprocketAuthResponse;
    this.token = data.token;
    return this.token;
  }

  /** Every real call goes through here so a stale cached token (expired mid-session) is retried exactly once with a fresh login, rather than failing a real request over a token that simply aged out. */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const doFetch = (bearer: string) =>
      fetch(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
          ...init.headers,
        },
      });

    let res = await doFetch(token);
    if (res.status === 401) {
      const freshToken = await this.getToken(true);
      res = await doFetch(freshToken);
    }
    if (!res.ok) {
      const body = await res.text();
      throw new InternalServerErrorException(
        `Shiprocket request to ${path} failed (${res.status}): ${body.slice(0, 300)}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private async fetchServiceabilityRaw(
    input: ServiceabilityInput,
  ): Promise<ShiprocketCourierOption[]> {
    const params = new URLSearchParams({
      pickup_postcode: input.pickupPincode,
      delivery_postcode: input.deliveryPincode,
      weight: String(input.weightKg),
      cod: input.isCod ? '1' : '0',
      declared_value: String(input.orderValue),
    });
    const data = await this.request<ShiprocketServiceabilityResponse>(
      `/courier/serviceability/?${params.toString()}`,
    );
    return data.data?.available_courier_companies ?? [];
  }

  async checkServiceability(
    input: ServiceabilityInput,
  ): Promise<ServiceabilityResult> {
    const options = await this.fetchServiceabilityRaw(input);
    return {
      serviceable: options.length > 0,
      couriers: options.map((c) => ({
        courierName: c.courier_name,
        rate: c.rate,
        etaDays: c.etd,
        codAvailable: c.cod === 1,
      })),
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreatedShipment> {
    this.requireConfig();
    const pickupLocation = this.config.shiprocketPickupLocation;
    if (!pickupLocation) {
      throw new InternalServerErrorException(
        'Shiprocket is not configured — SHIPROCKET_PICKUP_LOCATION is unset (the pickup address nickname registered in the Shiprocket dashboard).',
      );
    }

    const created = await this.request<ShiprocketCreateOrderResponse>(
      '/orders/create/adhoc',
      {
        method: 'POST',
        body: JSON.stringify({
          order_id: input.orderId,
          order_date: input.orderDate
            .toISOString()
            .slice(0, 19)
            .replace('T', ' '),
          pickup_location: pickupLocation,
          billing_customer_name: input.shippingAddress.fullName,
          billing_address: input.shippingAddress.addressLine1,
          billing_address_2: input.shippingAddress.addressLine2 ?? '',
          billing_city: input.shippingAddress.city,
          billing_pincode: input.shippingAddress.pincode,
          billing_state: input.shippingAddress.state,
          billing_country: input.shippingAddress.country,
          billing_email: input.shippingAddress.email ?? '',
          billing_phone: input.shippingAddress.phone,
          shipping_is_billing: true,
          order_items: input.items.map((item) => ({
            name: item.name,
            sku: item.name,
            units: item.quantity,
            selling_price: item.unitPrice,
          })),
          payment_method: input.isCod ? 'COD' : 'Prepaid',
          sub_total: input.subtotal,
          // Shiprocket requires non-zero dimensions; a real per-product
          // dimensions catalog doesn't exist in this project (see
          // apps/web/src/utils/packageDetails.ts's own "never used in
          // any shipping-cost calculation" disclaimer) — this is a
          // single reasonable placeholder parcel size, not a per-item
          // estimate, and is clearly named as such.
          length: 20,
          breadth: 15,
          height: 10,
          weight: input.weightKg,
        }),
      },
    );

    const pickupPincode =
      this.config.shiprocketPickupPincode ?? input.shippingAddress.pincode;
    const options = await this.fetchServiceabilityRaw({
      pickupPincode,
      deliveryPincode: input.shippingAddress.pincode,
      orderValue: input.subtotal,
      isCod: input.isCod,
      weightKg: input.weightKg,
    });
    const cheapest = [...options].sort((a, b) => a.rate - b.rate)[0];
    if (!cheapest) {
      throw new InternalServerErrorException(
        `No courier is serviceable for pincode ${input.shippingAddress.pincode}.`,
      );
    }

    const assigned = await this.request<ShiprocketAssignAwbResponse>(
      '/courier/assign/awb',
      {
        method: 'POST',
        body: JSON.stringify({
          shipment_id: created.shipment_id,
          courier_id: cheapest.courier_company_id,
        }),
      },
    );

    const { awb_code, courier_name } = assigned.response.data;
    return {
      courierName: courier_name,
      awbCode: awb_code,
      trackingUrl: `https://shiprocket.co/tracking/${awb_code}`,
    };
  }

  async trackShipment(awbCode: string): Promise<TrackedShipment> {
    const data = await this.request<ShiprocketTrackResponse>(
      `/courier/track/awb/${awbCode}`,
    );
    const activities = data.tracking_data?.shipment_track_activities ?? [];
    return {
      currentStatus:
        data.tracking_data?.shipment_track?.[0]?.current_status ?? 'UNKNOWN',
      events: activities.map((a) => ({
        status: a.status,
        location: a.location,
        timestamp: a.date,
      })),
    };
  }
}
