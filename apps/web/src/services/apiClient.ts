import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Needed for the real backend's refresh-token cookie (httpOnly,
  // Phase 5) to actually be sent/received — MSW's mock login never
  // needed this, since it has no real cookie to manage. Harmless for
  // same-origin mocked requests either way.
  withCredentials: true,
});

/**
 * apiClient deliberately never imports authStore directly — that would
 * create a real circular dependency (apiClient → authStore → authService
 * → apiClient). Instead, authStore calls these setters whenever its own
 * token state changes (login/logout/refresh), keeping apiClient fully
 * decoupled from any specific state-management choice. See
 * INTEGRATION.md for the full reasoning, part of Phase 10's auth-domain
 * integration work.
 */
let currentAccessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  currentAccessToken = token;
}

export function setRefreshHandler(handler: (() => Promise<string | null>) | null): void {
  refreshHandler = handler;
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (currentAccessToken) {
    config.headers.Authorization = `Bearer ${currentAccessToken}`;
  }
  return config;
});

// Tracks an in-flight refresh so concurrent 401s from several requests
// firing at once only trigger one real refresh call, not one per request.
let refreshInFlight: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint || !refreshHandler) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    refreshInFlight ??= refreshHandler().finally(() => {
      refreshInFlight = null;
    });

    const newToken = await refreshInFlight;
    if (!newToken) return Promise.reject(error);

    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  }
);
