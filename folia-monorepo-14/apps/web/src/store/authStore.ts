import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as authService from '@/services/authService';
import { setAccessToken, setRefreshHandler } from '@/services/apiClient';
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  updateProfile: (input: { firstName: string; lastName: string; email: string; phone?: string; avatarUrl?: string }) => Promise<boolean>;
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
          setAccessToken(token);
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
          setAccessToken(token);
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
          setAccessToken(null);
          set({ user: null, token: null, status: 'idle', error: null });
        }
      },

      // Called once after hydration (see App.tsx) to verify a persisted
      // token is still valid. See the doc comment on authService.fetchCurrentUser
      // for why this is expected to fail for non-demo accounts after a reload
      // (against MSW — against the real backend, Phase 10's refresh
      // interceptor is what actually keeps a session alive across a
      // reload, via the httpOnly cookie apiClient never sees directly).
      refreshSession: async () => {
        const { token, user } = get();
        if (!token || !user) return;
        try {
          const freshUser = await authService.fetchCurrentUser(token);
          set({ user: freshUser });
        } catch {
          setAccessToken(null);
          set({ user: null, token: null });
          useToastStore
            .getState()
            .showToast('info', "Your session expired — sign in again. (This demo's mock accounts don't persist across page reloads.)");
        }
      },

      clearError: () => set({ error: null }),

      changePassword: async (currentPassword, newPassword) => {
        const { token } = get();
        if (!token) return false;
        set({ status: 'pending', error: null });
        try {
          await authService.changePassword(token, currentPassword, newPassword);
          set({ status: 'idle', error: null });
          return true;
        } catch (error) {
          set({ status: 'error', error: messageFrom(error, 'Something went wrong changing your password.') });
          return false;
        }
      },

      updateProfile: async (input) => {
        const { token } = get();
        if (!token) return false;
        set({ status: 'pending', error: null });
        try {
          const user = await authService.updateProfile(token, input);
          set({ user, status: 'idle', error: null });
          return true;
        } catch (error) {
          set({ status: 'error', error: messageFrom(error, 'Something went wrong updating your profile.') });
          return false;
        }
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'folia-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        // A page reload creates a fresh apiClient module (currentAccessToken
        // starts null) even though localStorage may still have a
        // persisted token — without this, every request after a reload
        // would silently go out with no Authorization header until the
        // next login.
        if (state?.token) setAccessToken(state.token);
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * Registered once at module load — apiClient's response interceptor
 * calls this on a 401 (real backend only; see apiClient.ts's doc
 * comment). Converts a successful refresh into updated store state
 * (new user/token) and returns the new access token for the interceptor
 * to retry the original request with; returns null on failure, which
 * the interceptor treats as "give up, let the 401 propagate" rather
 * than looping.
 */
setRefreshHandler(async () => {
  const session = await authService.refresh();
  if (!session) return null;
  setAccessToken(session.token);
  useAuthStore.setState({ user: session.user, token: session.token });
  return session.token;
});
