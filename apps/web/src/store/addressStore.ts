import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as addressService from '@/services/addressService';
import type { Address, AddressInput } from '@/types/address';

type AsyncStatus = 'idle' | 'pending' | 'error';

interface AddressState {
  addresses: Address[];
  status: AsyncStatus;
  error: string | null;
  hasHydrated: boolean;

  fetchAddresses: () => Promise<void>;
  addAddress: (input: AddressInput) => Promise<Address | null>;
  editAddress: (id: string, input: AddressInput) => Promise<Address | null>;
  removeAddress: (id: string) => Promise<boolean>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

function extractMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const useAddressStore = create<AddressState>()(
  persist(
    (set) => ({
      addresses: [],
      status: 'idle',
      error: null,
      hasHydrated: false,

      // Always overwrites the local cache with the server's response —
      // addresses aren't security-sensitive like an auth token, so unlike
      // authStore's refreshSession, there's no reason to distrust the cache
      // beyond just replacing it with the current source of truth.
      fetchAddresses: async () => {
        set({ status: 'pending', error: null });
        try {
          const addresses = await addressService.fetchAddresses();
          set({ addresses, status: 'idle' });
        } catch (error) {
          set({ status: 'error', error: extractMessage(error, "Couldn't load your addresses.") });
        }
      },

      addAddress: async (input) => {
        set({ status: 'pending', error: null });
        try {
          const created = await addressService.createAddress(input);
          // Re-fetch rather than locally patch, since a new default flag can
          // cascade to clear the default on other addresses server-side.
          const addresses = await addressService.fetchAddresses();
          set({ addresses, status: 'idle' });
          return created;
        } catch (error) {
          set({ status: 'error', error: extractMessage(error, "Couldn't save that address.") });
          return null;
        }
      },

      editAddress: async (id, input) => {
        set({ status: 'pending', error: null });
        try {
          const updated = await addressService.updateAddress(id, input);
          const addresses = await addressService.fetchAddresses();
          set({ addresses, status: 'idle' });
          return updated;
        } catch (error) {
          set({ status: 'error', error: extractMessage(error, "Couldn't update that address.") });
          return null;
        }
      },

      removeAddress: async (id) => {
        set({ status: 'pending', error: null });
        try {
          await addressService.deleteAddress(id);
          const addresses = await addressService.fetchAddresses();
          set({ addresses, status: 'idle' });
          return true;
        } catch (error) {
          set({ status: 'error', error: extractMessage(error, "Couldn't remove that address.") });
          return false;
        }
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-addresses',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ addresses: state.addresses }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
