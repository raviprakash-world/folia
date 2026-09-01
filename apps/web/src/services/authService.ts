import { apiClient } from './apiClient';
import { extractApiErrorMessage } from '@/utils/apiError';
import { AuthError } from '@/types/auth';
import type { AuthSession, User } from '@/types/auth';

export async function login(email: string, password: string): Promise<AuthSession> {
  try {
    const { data } = await apiClient.post<AuthSession>('/auth/login', { email, password });
    return data;
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'Something went wrong signing in.'));
  }
}

export async function register(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}): Promise<AuthSession> {
  try {
    const { data } = await apiClient.post<AuthSession>('/auth/register', input);
    return data;
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'Something went wrong creating your account.'));
  }
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

/**
 * Real backend only (Phase 10) — the mock has no refresh-token cookie to
 * exchange, so this has no equivalent MSW handler and simply isn't
 * called unless VITE_REAL_AUTH_API=true. Never throws on failure (an
 * expired/absent refresh cookie is an expected, common case, not an
 * error worth an AuthError) — returns null instead, letting the caller
 * (apiClient's response interceptor) decide what that means.
 */
export async function refresh(): Promise<AuthSession | null> {
  try {
    const { data } = await apiClient.post<AuthSession>('/auth/refresh');
    return data;
  } catch {
    return null;
  }
}

/**
 * Verifies a persisted token against the mock /auth/me endpoint. Note the
 * mock user "database" (src/mocks/authHandlers.ts) is an in-memory array
 * that resets on every page reload, while the auth store's token survives
 * in localStorage — so this call is expected to fail for any account
 * registered earlier in a previous session, and only the seeded demo
 * account (demo@folia.example) survives a reload. That's a real, honest
 * limitation of a mock backend with no real database, not a bug.
 */
export async function fetchCurrentUser(token: string): Promise<User> {
  try {
    const { data } = await apiClient.get<User>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'Your session is no longer valid.'));
  }
}

export async function requestPasswordReset(email: string): Promise<{ devToken?: string }> {
  const { data } = await apiClient.post<{ ok: boolean; devToken?: string }>('/auth/forgot-password', { email });
  return { devToken: data.devToken };
}

export async function resetPassword(token: string, password: string): Promise<void> {
  try {
    await apiClient.post('/auth/reset-password', { token, password });
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'That reset link is invalid or has expired.'));
  }
}

export async function changePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  try {
    await apiClient.post(
      '/auth/change-password',
      { currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'Something went wrong changing your password.'));
  }
}

export async function updateProfile(
  token: string,
  input: { firstName: string; lastName: string; email: string; phone?: string; avatarUrl?: string }
): Promise<User> {
  try {
    const { data } = await apiClient.put<User>('/auth/me', input, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new AuthError(extractApiErrorMessage(error, 'Something went wrong updating your profile.'));
  }
}
