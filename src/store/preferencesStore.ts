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
  toggleNotification: (key: keyof NotificationPrefs) => void;
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
      toggleNotification: (key) =>
        set({ notifications: { ...get().notifications, [key]: !get().notifications[key] } }),
    }),
    {
      name: 'folia-preferences',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
