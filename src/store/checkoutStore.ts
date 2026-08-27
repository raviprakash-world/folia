import { create } from 'zustand';
import type { DeliveryMethodType, PaymentSummary } from '@/types/order';

interface CheckoutState {
  shippingAddressId: string | null;
  billingSameAsShipping: boolean;
  billingAddressId: string | null;
  deliveryMethod: DeliveryMethodType | null;
  deliveryCost: number;
  deliveryEta: string | null;
  payment: PaymentSummary | null;

  setShippingAddressId: (id: string) => void;
  setBillingSameAsShipping: (same: boolean) => void;
  setBillingAddressId: (id: string) => void;
  setDelivery: (method: DeliveryMethodType, cost: number, eta: string) => void;
  setPayment: (payment: PaymentSummary) => void;
  reset: () => void;
}

const initialState = {
  shippingAddressId: null,
  billingSameAsShipping: true,
  billingAddressId: null,
  deliveryMethod: null,
  deliveryCost: 0,
  deliveryEta: null,
  payment: null,
};

export const useCheckoutStore = create<CheckoutState>((set) => ({
  ...initialState,

  setShippingAddressId: (id) => set({ shippingAddressId: id }),
  setBillingSameAsShipping: (same) => set({ billingSameAsShipping: same }),
  setBillingAddressId: (id) => set({ billingAddressId: id }),
  setDelivery: (method, cost, eta) => set({ deliveryMethod: method, deliveryCost: cost, deliveryEta: eta }),
  setPayment: (payment) => set({ payment }),
  reset: () => set(initialState),
}));
