import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface DeliveryLocation {
  pincode: string;
  /** May be empty when the PIN lookup service was unreachable — state-based filtering is then unavailable. */
  city: string;
  state: string;
  source: 'detected' | 'manual';
}

interface LocationState {
  location: DeliveryLocation | null;
  pickerOpen: boolean;
  setLocation: (location: DeliveryLocation) => void;
  clearLocation: () => void;
  openPicker: () => void;
  closePicker: () => void;
}

/**
 * The visitor's chosen delivery location, kept on their device only (PIN +
 * city + state — never coordinates). Nothing here is sent to Folia's
 * servers; it just tailors what the storefront shows.
 */
export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      pickerOpen: false,
      setLocation: (location) => set({ location, pickerOpen: false }),
      clearLocation: () => set({ location: null }),
      openPicker: () => set({ pickerOpen: true }),
      closePicker: () => set({ pickerOpen: false }),
    }),
    {
      name: 'folia-location',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ location: s.location }),
    },
  ),
);
