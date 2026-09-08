import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  fetchSellerProfile,
  applyAsSeller,
  updateSellerProfile,
  fetchSellerVerifications,
  uploadSellerVerification,
} from '@/services/sellerDashboardApiService';
import type { ApplyAsSellerInput } from '@/services/sellerDashboardApiService';

/** Marketplace Phase 15 — the seller dashboard has no MSW mock path (same as /admin), matching AdminAnalytics's own useRealAdminApi gate exactly. */
export const useRealSellersApi = import.meta.env.VITE_REAL_SELLERS_API === 'true';

const PROFILE_QUERY_KEY = ['seller-profile'];

/** Only queries once the caller is actually authenticated with the seller role — a plain customer hitting this hook (e.g. before applying) would otherwise 404 against a real backend call that can never succeed for them. */
export function useSellerProfile() {
  const role = useAuthStore((s) => s.user?.role);
  const { data: profile, isLoading } = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchSellerProfile,
    enabled: useRealSellersApi && role === 'seller',
  });
  return { profile, isLoading };
}

export function useApplyAsSeller() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyAsSellerInput) => applyAsSeller(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  });
}

export function useUpdateSellerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ApplyAsSellerInput>) => updateSellerProfile(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY }),
  });
}

const VERIFICATIONS_QUERY_KEY = ['seller-verifications'];

export function useSellerVerifications() {
  const role = useAuthStore((s) => s.user?.role);
  const { data, isLoading } = useQuery({
    queryKey: VERIFICATIONS_QUERY_KEY,
    queryFn: fetchSellerVerifications,
    enabled: useRealSellersApi && role === 'seller',
  });
  return { verifications: data ?? [], isLoading };
}

export function useUploadSellerVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentType, files }: { documentType: string; files: File[] }) =>
      uploadSellerVerification(documentType, files),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: VERIFICATIONS_QUERY_KEY }),
  });
}
