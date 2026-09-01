import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Phase 15 (backend integration) — "archive" turned out to be a real,
 * user-initiated UI feature (a toggle button, a filtered view) that the
 * Phase 15A audit missed: it only checked notification-creation call
 * sites, not this separate interaction. The real backend's Notification
 * model deliberately has no archived field (none of the 6 real creation
 * trigger points ever set one) — going back to add real server storage
 * for a feature discovered this late, after the model/service/tests/seed
 * data were already built and verified, was judged a larger ripple than
 * the value justified tonight. A stated scope cut, not a hidden gap:
 * archiving stays a small, local-only overlay — a set of IDs — that
 * applies identically on top of notifications from either data source
 * (local store or real API), rather than being persisted server-side or
 * synced across devices.
 */
interface ArchivedNotificationsState {
  archivedIds: string[];
  toggleArchived: (id: string) => void;
  isArchived: (id: string) => boolean;
}

export const useArchivedNotificationsStore = create<ArchivedNotificationsState>()(
  persist(
    (set, get) => ({
      archivedIds: [],
      toggleArchived: (id) => {
        const current = get().archivedIds;
        set({
          archivedIds: current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
        });
      },
      isArchived: (id) => get().archivedIds.includes(id),
    }),
    {
      name: 'folia-archived-notifications',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
