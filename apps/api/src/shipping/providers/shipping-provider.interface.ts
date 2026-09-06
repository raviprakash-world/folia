/**
 * What ShippingService/OrdersService need from any real courier
 * aggregator — deliberately narrow and Shiprocket-agnostic (no Shiprocket
 * request/response shapes leak into these signatures), matching this
 * codebase's existing PaymentProviderClient/EmailService abstraction
 * pattern. A second provider (Delhivery direct, a different aggregator)
 * is a new class implementing this interface plus a new binding in
 * ShippingModule — no change to ShippingService, OrdersService, or any
 * controller.
 */
export interface ServiceabilityInput {
  /** 6-digit Indian PIN code the shipment would originate from. */
  pickupPincode: string;
  /** 6-digit Indian PIN code the shipment would be delivered to. */
  deliveryPincode: string;
  /** Order value in rupees — couriers price COD risk/fees off this. */
  orderValue: number;
  /** Whether this would be a cash-on-delivery shipment (affects which couriers/rates are offered). */
  isCod: boolean;
  /** Total package weight in kilograms. */
  weightKg: number;
}

export interface ServiceableCourier {
  courierName: string;
  rate: number;
  etaDays: string;
  codAvailable: boolean;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  couriers: ServiceableCourier[];
}

export interface ShipmentAddress {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone: string;
  email?: string;
}

export interface ShipmentItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateShipmentInput {
  /** Our own order id, passed through so a support agent can correlate a Shiprocket dashboard entry back to a Folia order without a database lookup — same reasoning as PaymentProviderClient's CreateGatewayOrderInput.receipt. */
  orderId: string;
  orderDate: Date;
  shippingAddress: ShipmentAddress;
  items: ShipmentItem[];
  subtotal: number;
  isCod: boolean;
  weightKg: number;
}

export interface CreatedShipment {
  /** The courier's real, human-readable name (e.g. "Delhivery Surface") — display this directly, never assume it's one of a fixed set. */
  courierName: string;
  /** The real Air Waybill / tracking number a customer could enter on the courier's own site. */
  awbCode: string;
  /** A direct, real link to the shipment's tracking page, when the provider returns one. */
  trackingUrl?: string;
}

export interface TrackedShipmentEvent {
  status: string;
  location?: string;
  timestamp: string;
}

export interface TrackedShipment {
  currentStatus: string;
  events: TrackedShipmentEvent[];
}

export interface ShippingProviderClient {
  checkServiceability(
    input: ServiceabilityInput,
  ): Promise<ServiceabilityResult>;
  createShipment(input: CreateShipmentInput): Promise<CreatedShipment>;
  trackShipment(awbCode: string): Promise<TrackedShipment>;
}

export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');
