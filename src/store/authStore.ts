import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as authService from '@/services/authService';
import { AuthError } from '@/types/auth';
import type { User } from '@/types/auth';
import { useToastStore } from '@/store/toastStore';

type AuthStatus = 'idle' | 'pending' | 'error';

interface AuthState {
  user: User | null;
  token: string | null;
  status: AuthStatus;
  error: string | null;
  hasHydrated: boolean;

  login: (email: string, password: string) => Promise<boolean>;
  register: (input: { firstName: string; lastName: string; email: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof AuthError ? error.message : fallback;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      status: 'idle',
      error: null,
      hasHydrated: false,

      login: async (email, password) => {
        set({ status: 'pending', error: null });
        try {
          const { user, token } = await authService.login(email, password);
          set({ user, token, status: 'idle', error: null });
          return true;
        } catch (error) {
          set({ status: 'error', error: messageFrom(error, 'Something went wrong signing in.') });
          return false;
        }
      },

      register: async (input) => {
        set({ status: 'pending', error: null });
        try {
          const { user, token } = await authService.register(input);
          set({ user, token, status: 'idle', error: null });
          return true;
        } catch (error) {
          set({ status: 'error', error: messageFrom(error, 'Something went wrong creating your account.') });
          return false;
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } finally {
          set({ user: null, token: null, status: 'idle', error: null });
        }
      },

      // Called once after hydration (see App.tsx) to verify a persisted
      // token is still valid. See the doc comment on authService.fetchCurrentUser
      // for why this is expected to fail for non-demo accounts after a reload.
      refreshSession: async () => {
        const { token, user } = get();
        if (!token || !user) return;
        try {
          const freshUser = await authService.fetchCurrentUser(token);
          set({ user: freshUser });
        } catch {
          set({ user: null, token: null });
          useToastStore
            .getState()
            .showToast('info', "Your session expired — sign in again. (This demo's mock accounts don't persist across page reloads.)");
        }
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
