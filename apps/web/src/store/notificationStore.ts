import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Notification, NotificationType } from '@/types/notification';

interface NotificationState {
  notifications: Notification[];
  hasSeeded: boolean;
  hasHydrated: boolean;

  addNotification: (input: { type: NotificationType; title: string; message: string; href?: string }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
  deleteNotification: (id: string) => void;
  seedIfEmpty: () => void;
  setHasHydrated: (value: boolean) => void;
}

function makeId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      hasSeeded: false,
      hasHydrated: false,

      addNotification: (input) => {
        const notification: Notification = {
          id: makeId(),
          type: input.type,
          title: input.title,
          message: input.message,
          href: input.href,
          createdAt: new Date().toISOString(),
          read: false,
          archived: false,
        };
        set({ notifications: [notification, ...get().notifications] });
      },

      markAsRead: (id) =>
        set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }),

      markAllAsRead: () => set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),

      archiveNotification: (id) =>
        set({
          notifications: get().notifications.map((n) => (n.id === id ? { ...n, archived: true, read: true } : n)),
        }),

      deleteNotification: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),

      // Called once, from the notification center page — seeds a couple of
      // illustrative examples for types this mock catalog has no live
      // trigger for (price drops, restocks, promotions never organically
      // fire without a real inventory/pricing feed). Guarded by hasSeeded
      // so deleting them doesn't bring them back.
      seedIfEmpty: () => {
        if (get().hasSeeded) return;
        const now = Date.now();
        const seeded: Notification[] = [
          {
            id: makeId(),
            type: 'promotion',
            title: 'Free shipping this week',
            message: 'Orders over $75 ship free — no code needed.',
            createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
            read: false,
            archived: false,
            href: '/shop',
          },
          {
            id: makeId(),
            type: 'wishlist',
            title: 'Price drop on your wishlist',
            message: 'An item on your wishlist is now on sale.',
            createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
            read: false,
            archived: false,
            href: '/wishlist',
          },
        ];
        set({ notifications: [...seeded, ...get().notifications], hasSeeded: true });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-notifications',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ notifications: state.notifications, hasSeeded: state.hasSeeded }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
