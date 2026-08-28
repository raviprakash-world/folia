import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

interface ThemeState {
  mode: ThemeMode;
  /** Live OS preference — not persisted, since it should always reflect the current system setting, not a stale snapshot. */
  systemPrefersDark: boolean;
  hasHydrated: boolean;
  setMode: (mode: ThemeMode) => void;
  setSystemPrefersDark: (value: boolean) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      systemPrefersDark: getSystemPrefersDark(),
      hasHydrated: false,
      setMode: (mode) => set({ mode }),
      setSystemPrefersDark: (value) => set({ systemPrefersDark: value }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** The theme actually in effect right now — 'system' resolves against the live OS preference, never a stored snapshot. */
export function useResolvedTheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const systemPrefersDark = useThemeStore((s) => s.systemPrefersDark);
  return mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;
}
