import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 10;
const MAX_ANALYTICS_EVENTS = 50;

export interface SearchAnalyticsEvent {
  query: string;
  resultCount: number;
  timestamp: string;
  clickedResultId?: string;
}

interface SearchState {
  recentSearches: string[];
  analyticsEvents: SearchAnalyticsEvent[];
  hasHydrated: boolean;

  addRecentSearch: (term: string) => void;
  clearRecentSearches: () => void;
  logSearchEvent: (event: Omit<SearchAnalyticsEvent, 'timestamp'>) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useSearchStore = create<SearchState>()(
  persist(
    (set, get) => ({
      recentSearches: [],
      analyticsEvents: [],
      hasHydrated: false,

      addRecentSearch: (term) => {
        const trimmed = term.trim();
        if (!trimmed) return;
        const withoutDuplicate = get().recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
        set({ recentSearches: [trimmed, ...withoutDuplicate].slice(0, MAX_RECENT_SEARCHES) });
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      // Logged locally for now — there's no admin dashboard in this app yet
      // to consume it, but the event shape and capture point are real,
      // ready for one to read from this store later.
      logSearchEvent: (event) => {
        const entry: SearchAnalyticsEvent = { ...event, timestamp: new Date().toISOString() };
        set({ analyticsEvents: [entry, ...get().analyticsEvents].slice(0, MAX_ANALYTICS_EVENTS) });
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-search',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ recentSearches: state.recentSearches, analyticsEvents: state.analyticsEvents }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
