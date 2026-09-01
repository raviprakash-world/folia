import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '@/store/notificationStore';
import { useArchivedNotificationsStore } from '@/store/archivedNotificationsStore';
import {
  fetchRealNotifications,
  markRealNotificationAsRead,
  markAllRealNotificationsAsRead,
  deleteRealNotification,
} from '@/services/notificationsApiService';
import type { Notification } from '@/types/notification';

const useRealNotificationsApi = import.meta.env.VITE_REAL_NOTIFICATIONS_API === 'true';
const QUERY_KEY = ['real-notifications'];

/**
 * TanStack Query for real server state, a small local store only for the
 * archive overlay (see archivedNotificationsStore.ts) — matching this
 * project's stated preference (TanStack Query → server state, Zustand →
 * ephemeral/local-only UI state) rather than duplicating notification
 * data into a second Zustand store. Both hooks are always called
 * unconditionally (Rules of Hooks — see useSearchResults.ts's identical
 * reasoning), with only the selected path actually making a request.
 */
export function useNotifications() {
  const archivedIds = useArchivedNotificationsStore((s) => s.archivedIds);
  const toggleArchived = useArchivedNotificationsStore((s) => s.toggleArchived);
  const queryClient = useQueryClient();

  const localNotifications = useNotificationStore((s) => s.notifications);
  const localHasHydrated = useNotificationStore((s) => s.hasHydrated);
  const localSeedIfEmpty = useNotificationStore((s) => s.seedIfEmpty);
  const localMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const localMarkAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const localDeleteNotification = useNotificationStore((s) => s.deleteNotification);

  const { data: realData, isLoading: realLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRealNotifications,
    enabled: useRealNotificationsApi,
  });

  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds]);

  const notifications: Notification[] = useMemo(() => {
    const source = useRealNotificationsApi ? (realData ?? []) : localNotifications;
    return source.map((n) => ({ ...n, archived: archivedSet.has(n.id) }));
  }, [realData, localNotifications, archivedSet]);

  async function markAsRead(id: string) {
    if (useRealNotificationsApi) {
      await markRealNotificationAsRead(id);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } else {
      localMarkAsRead(id);
    }
  }

  async function markAllAsRead() {
    if (useRealNotificationsApi) {
      await markAllRealNotificationsAsRead();
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } else {
      localMarkAllAsRead();
    }
  }

  async function deleteNotification(id: string) {
    if (useRealNotificationsApi) {
      await deleteRealNotification(id);
      await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    } else {
      localDeleteNotification(id);
    }
  }

  // seedIfEmpty is local-only-path behavior (illustrative examples for
  // types this mock catalog has no live trigger for) — a no-op for the
  // real path, where the real seed script (Phase 15I) already covers
  // this for the demo account.
  function seedIfEmpty() {
    if (!useRealNotificationsApi) localSeedIfEmpty();
  }

  return {
    notifications,
    hasHydrated: useRealNotificationsApi ? !realLoading : localHasHydrated,
    markAsRead,
    markAllAsRead,
    archiveNotification: toggleArchived,
    deleteNotification,
    seedIfEmpty,
  };
}

export function useUnreadNotificationCount(): number {
  const { notifications, hasHydrated } = useNotifications();
  return hasHydrated ? notifications.filter((n) => !n.read && !n.archived).length : 0;
}
