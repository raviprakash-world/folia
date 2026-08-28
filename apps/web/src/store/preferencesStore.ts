import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NotificationPrefs {
  orderConfirmationEmail: boolean;
  shippingUpdatesEmail: boolean;
  deliveryUpdatesSms: boolean;
  marketingEmail: boolean;
}

interface PreferencesState {
  notifications: NotificationPrefs;
  hasHydrated: boolean;
  toggleNotification: (key: keyof NotificationPrefs) => void;
  setHasHydrated: (value: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      notifications: {
        orderConfirmationEmail: true,
        shippingUpdatesEmail: true,
        deliveryUpdatesSms: false,
        marketingEmail: false,
      },
      hasHydrated: false,
      toggleNotification: (key) =>
        set({ notifications: { ...get().notifications, [key]: !get().notifications[key] } }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ notifications: state.notifications }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
