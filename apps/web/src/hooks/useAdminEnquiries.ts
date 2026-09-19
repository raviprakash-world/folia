import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealAdminApi } from './useAdminAnalytics';
import { fetchAdminEnquiries, markEnquiryHandled } from '@/services/adminEnquiriesApiService';
import type { EnquiryStatus } from '@/services/adminEnquiriesApiService';

export { useRealAdminApi };

export function useAdminEnquiries(status: EnquiryStatus, page: number, pageSize = 20) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-enquiries', status, page, pageSize],
    queryFn: () => fetchAdminEnquiries(status, page, pageSize),
    enabled: useRealAdminApi,
  });
  return { items: data?.items ?? [], total: data?.total ?? 0, isLoading };
}

export function useMarkEnquiryHandled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markEnquiryHandled,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-enquiries'] }),
  });
}
