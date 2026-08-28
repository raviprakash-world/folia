import { useEffect, useRef } from 'react';
import { useAddressStore } from '@/store/addressStore';

/** Call once per page that needs a fresh address list — resyncs the persisted cache against the mock backend. */
export function useAddressBootstrap() {
  const hasHydrated = useAddressStore((s) => s.hasHydrated);
  const fetchAddresses = useAddressStore((s) => s.fetchAddresses);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (hasHydrated && !fetchedRef.current) {
      fetchedRef.current = true;
      void fetchAddresses();
    }
  }, [hasHydrated, fetchAddresses]);
}

export function useDefaultShippingAddress() {
  return useAddressStore((s) => s.addresses.find((a) => a.isDefaultShipping) ?? null);
}

export function useDefaultBillingAddress() {
  return useAddressStore((s) => s.addresses.find((a) => a.isDefaultBilling) ?? null);
}
