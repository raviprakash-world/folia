import { apiClient } from './apiClient';
import type { Order, OrderStatus } from '@/types/order';
import type { User } from '@/types/auth';
import type { Product } from '@/types/product';

// --- Analytics (apps/api/src/analytics) ---

export interface AdminOverview {
  revenue: number;
  orders: { total: number; byStatus: Record<string, number> };
  customers: {
    totalCustomers: number;
    repeatCustomers: number;
    repeatPurchaseRate: number;
  };
}

export interface DailyMetric {
  date: string;
  orders: number;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  unitsSold: number;
}

export interface DateRangeQuery {
  dateFrom?: string;
  dateTo?: string;
}

export async function fetchAdminOverview(range: DateRangeQuery = {}): Promise<AdminOverview> {
  const { data } = await apiClient.get<AdminOverview>('/analytics/overview', { params: range });
  return data;
}

export async function fetchAdminDailyMetrics(days = 30): Promise<DailyMetric[]> {
  const { data } = await apiClient.get<DailyMetric[]>('/analytics/daily', { params: { days } });
  return data;
}

export async function fetchAdminTopProducts(
  direction: 'best' | 'worst' = 'best',
  limit = 10
): Promise<TopProduct[]> {
  const { data } = await apiClient.get<TopProduct[]>('/analytics/top-products', {
    params: { direction, limit },
  });
  return data;
}

export async function fetchAdminCustomerStats(range: DateRangeQuery = {}): Promise<AdminOverview['customers']> {
  const { data } = await apiClient.get<AdminOverview['customers']>('/analytics/customers', { params: range });
  return data;
}

export async function fetchAdminOrderStats(range: DateRangeQuery = {}): Promise<AdminOverview['orders']> {
  const { data } = await apiClient.get<AdminOverview['orders']>('/analytics/orders', { params: range });
  return data;
}

export async function fetchAdminTrendingSearches(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/analytics/search');
  return data;
}

/** Real PRODUCT_VIEW event counts — the one real "engagement" signal that exists server-side (no equivalent for wishlist adds, returns, or search no-result/click-through, which stay mock-only even in real-API mode — see useAdminAnalytics.ts). */
export async function fetchAdminMostViewedProducts(): Promise<{ productId: string; count: number }[]> {
  const { data } = await apiClient.get<{ productId: string; count: number }[]>('/analytics/products');
  return data;
}

// --- Order management (apps/api/src/admin/admin-orders.controller.ts) ---

export async function fetchAdminOrders(status?: string): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>('/admin/orders', {
    params: status ? { status } : undefined,
  });
  return data;
}

/** Forward fulfillment transitions only (confirmed/shipped/delivered) — matches the backend's own canTransitionStatus, which deliberately excludes cancel/return (those have their own dedicated customer-facing endpoints). */
export async function updateAdminOrderStatus(
  id: string,
  status: Extract<OrderStatus, 'confirmed' | 'shipped' | 'delivered'>
): Promise<Order> {
  const dbStatus = status.toUpperCase();
  const { data } = await apiClient.put<Order>(`/admin/orders/${id}/status`, { status: dbStatus });
  return data;
}

// --- Product management (apps/api/src/admin/admin-products.controller.ts) ---

export interface AdminProductInput {
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  categoryId: string;
  brandId?: string;
  badge?: 'New' | 'Sale' | 'Bestseller' | 'Low stock';
  careLevel?: 'Easy' | 'Moderate' | 'Advanced';
}

export async function createAdminProduct(input: AdminProductInput): Promise<Product> {
  const { data } = await apiClient.post<Product>('/admin/products', input);
  return data;
}

export async function updateAdminProduct(id: string, input: AdminProductInput): Promise<Product> {
  const { data } = await apiClient.put<Product>(`/admin/products/${id}`, input);
  return data;
}

export async function deleteAdminProduct(id: string): Promise<void> {
  await apiClient.delete(`/admin/products/${id}`);
}

// --- User management (apps/api/src/admin/admin-users.controller.ts) ---

export async function fetchAdminUsers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/admin/users');
  return data;
}

export async function updateAdminUserRole(id: string, role: 'customer' | 'admin'): Promise<User> {
  const { data } = await apiClient.put<User>(`/admin/users/${id}/role`, { role });
  return data;
}

export async function deactivateAdminUser(id: string): Promise<void> {
  await apiClient.delete(`/admin/users/${id}`);
}
