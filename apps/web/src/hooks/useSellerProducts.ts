import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealSellersApi } from './useSellerProfile';
import {
  fetchSellerProducts,
  fetchSellerProduct,
  createSellerProduct,
  updateSellerProduct,
  submitSellerProduct,
  archiveSellerProduct,
  uploadSellerProductMedia,
  deleteSellerProductMedia,
} from '@/services/sellerDashboardApiService';
import type { SellerProductInput, UpdateSellerProductInput } from '@/types/sellerDashboard';

export { useRealSellersApi };

const LIST_QUERY_KEY = ['seller-products'];
const DETAIL_QUERY_KEY = (id: string) => ['seller-product', id];

export function useSellerProductsList() {
  const { data, isLoading } = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: fetchSellerProducts,
    enabled: useRealSellersApi,
  });
  return { items: data ?? [], isLoading };
}

/** A single product plus every seller action SellerProductDetail.tsx needs — one useMutation per action, each invalidating both this product's own query and the list so the table reflects a change immediately. */
export function useSellerProductDetail(id: string | undefined) {
  const queryClient = useQueryClient();
  const detailKey = DETAIL_QUERY_KEY(id ?? '');

  const { data: product, isLoading } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchSellerProduct(id!),
    enabled: useRealSellersApi && !!id,
  });

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailKey }),
      queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY }),
    ]);
  }

  const updateMutation = useMutation({
    mutationFn: (input: UpdateSellerProductInput) => updateSellerProduct(id!, input),
    onSuccess: invalidateAll,
  });
  const submitMutation = useMutation({
    mutationFn: () => submitSellerProduct(id!),
    onSuccess: invalidateAll,
  });
  const archiveMutation = useMutation({
    mutationFn: () => archiveSellerProduct(id!),
    onSuccess: invalidateAll,
  });
  const uploadMediaMutation = useMutation({
    mutationFn: (files: File[]) => uploadSellerProductMedia(id!, files),
    onSuccess: invalidateAll,
  });
  const deleteMediaMutation = useMutation({
    mutationFn: (imageId: string) => deleteSellerProductMedia(id!, imageId),
    onSuccess: invalidateAll,
  });

  return {
    product,
    isLoading,
    update: updateMutation,
    submit: submitMutation,
    archive: archiveMutation,
    uploadMedia: uploadMediaMutation,
    deleteMedia: deleteMediaMutation,
  };
}

export function useCreateSellerProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SellerProductInput) => createSellerProduct(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY }),
  });
}
