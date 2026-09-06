import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useOrderStore } from '@/store/orderStore';
import { useWishlistStore } from '@/store/wishlistStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useSearchStore } from '@/store/searchStore';
import {
  getUnifiedOrders,
  getRevenueSeries,
  getRevenueTotals,
  getOrdersPerDay,
  getOrdersByStatus,
  getOrderPerformance,
  getBestSellers,
  getWorstSellers,
  getMostReturned,
  getMostViewed,
  getMostWishlisted,
  getFrequentlyBoughtTogetherPairs,
  getCustomerTotals,
  getTopSearches,
  getNoResultSearches,
  getSearchConversion,
} from '@/utils/analytics';
import {
  fetchAdminDailyMetrics,
  fetchAdminOrderStats,
  fetchAdminOverview,
  fetchAdminTopProducts,
  fetchAdminMostViewedProducts,
  fetchAdminTrendingSearches,
} from '@/services/adminApiService';
import type { RevenueGranularity, RevenuePoint, RevenueTotals, OrdersPerDayPoint, StatusBreakdown, OrderPerformance, ProductMetric, CustomerTotals, SearchTermMetric } from '@/utils/analytics';

export const useRealAdminApi = import.meta.env.VITE_REAL_ADMIN_API === 'true';

/** The one join point every mock-mode admin hook below builds on — real live orders merged with the deterministic mock baseline. Unused entirely in real mode. */
function useUnifiedOrdersData() {
  const liveOrders = useOrderStore((s) => s.orders);
  return useMemo(() => getUnifiedOrders(liveOrders), [liveOrders]);
}

const ZERO_TOTALS: RevenueTotals = { grossRevenue: 0, netRevenue: 0, totalDiscounts: 0, shippingRevenue: 0 };

/**
 * Real mode deliberately does NOT fabricate a gross/net/discount/shipping
 * breakdown — the real backend (AnalyticsService.getDailyOrderMetrics)
 * only tracks total Order.total per day, not a decomposition into those
 * four categories. `gross` and `net` are set equal to that one real
 * number (never invented separately), and `discounts`/`shipping` stay 0
 * — AdminRevenue.tsx (the one page that visually breaks these out) knows
 * to hide the discount/shipping cards in real mode rather than display
 * those zeros as if they were measured.
 */
export function useRevenueAnalytics(granularity: RevenueGranularity, windowDays = 90) {
  const orders = useUnifiedOrdersData();
  const mockSeries = useMemo(
    () => (useRealAdminApi ? [] : getRevenueSeries(orders, granularity, windowDays)),
    [orders, granularity, windowDays]
  );
  const mockTotals = useMemo(
    () => (useRealAdminApi ? ZERO_TOTALS : getRevenueTotals(orders, windowDays)),
    [orders, windowDays]
  );
  const mockPreviousTotals = useMemo(() => {
    if (useRealAdminApi) return 0;
    const allSeries = getRevenueSeries(orders, 'daily', windowDays * 2);
    const cutoff = allSeries.length - Math.min(allSeries.length, Math.round(allSeries.length / 2));
    return allSeries.slice(0, cutoff).reduce((sum, p) => sum + p.gross, 0);
  }, [orders, windowDays]);

  const { data: daily } = useQuery({
    queryKey: ['admin-daily', windowDays],
    queryFn: () => fetchAdminDailyMetrics(windowDays),
    enabled: useRealAdminApi,
  });
  const { data: dailyDouble } = useQuery({
    queryKey: ['admin-daily', windowDays * 2],
    queryFn: () => fetchAdminDailyMetrics(windowDays * 2),
    enabled: useRealAdminApi,
  });

  const realSeries = useMemo<RevenuePoint[]>(
    () => (daily ?? []).map((d) => ({ label: d.date, gross: d.revenue, net: d.revenue, discounts: 0, shipping: 0 })),
    [daily]
  );
  const realTotals = useMemo<RevenueTotals>(
    () => ({
      grossRevenue: realSeries.reduce((sum, p) => sum + p.gross, 0),
      netRevenue: realSeries.reduce((sum, p) => sum + p.net, 0),
      totalDiscounts: 0,
      shippingRevenue: 0,
    }),
    [realSeries]
  );
  const realPreviousTotal = useMemo(() => {
    const all = dailyDouble ?? [];
    const cutoff = all.length - Math.min(all.length, Math.round(all.length / 2));
    return all.slice(0, cutoff).reduce((sum, d) => sum + d.revenue, 0);
  }, [dailyDouble]);

  const series = useRealAdminApi ? realSeries : mockSeries;
  const totals = useRealAdminApi ? realTotals : mockTotals;
  const previousTotal = useRealAdminApi ? realPreviousTotal : mockPreviousTotals;

  const revenueTrend = useMemo<{ value: number; direction: 'up' | 'down' } | null>(() => {
    if (previousTotal <= 0) return null;
    const change = ((totals.grossRevenue - previousTotal) / previousTotal) * 100;
    return { value: Math.round(Math.abs(change) * 10) / 10, direction: change >= 0 ? 'up' : 'down' };
  }, [totals.grossRevenue, previousTotal]);

  return { series, totals, revenueTrend };
}

/** Real order performance (delivery/cancellation/return rate) is fully derivable from real status counts — nothing fabricated here, unlike the revenue breakdown above. */
export function useOrdersAnalytics(days = 30, windowDays = 90) {
  const orders = useUnifiedOrdersData();
  const mockPerDay = useMemo(() => (useRealAdminApi ? [] : getOrdersPerDay(orders, days)), [orders, days]);
  const mockByStatus = useMemo(() => (useRealAdminApi ? [] : getOrdersByStatus(orders, windowDays)), [orders, windowDays]);
  const mockPerformance = useMemo(
    () => (useRealAdminApi ? { deliveryRate: 0, cancellationRate: 0, returnRate: 0, totalOrders: 0 } : getOrderPerformance(orders, windowDays)),
    [orders, windowDays]
  );

  const { data: daily } = useQuery({
    queryKey: ['admin-daily', days],
    queryFn: () => fetchAdminDailyMetrics(days),
    enabled: useRealAdminApi,
  });
  const { data: stats } = useQuery({
    queryKey: ['admin-order-stats', windowDays],
    queryFn: () => fetchAdminOrderStats(),
    enabled: useRealAdminApi,
  });

  const realPerDay = useMemo<OrdersPerDayPoint[]>(
    () => (daily ?? []).map((d) => ({ label: d.date, count: d.orders })),
    [daily]
  );
  const realByStatus = useMemo<StatusBreakdown[]>(
    () => Object.entries(stats?.byStatus ?? {}).map(([status, count]) => ({ status: status.toLowerCase(), count })),
    [stats]
  );
  const realPerformance = useMemo<OrderPerformance>(() => {
    const byStatus = stats?.byStatus ?? {};
    const total = stats?.total || 0;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    return {
      deliveryRate: pct(byStatus.DELIVERED ?? 0),
      cancellationRate: pct(byStatus.CANCELLED ?? 0),
      returnRate: pct(byStatus.RETURNED ?? 0),
      totalOrders: total,
    };
  }, [stats]);

  return {
    perDay: useRealAdminApi ? realPerDay : mockPerDay,
    byStatus: useRealAdminApi ? realByStatus : mockByStatus,
    performance: useRealAdminApi ? realPerformance : mockPerformance,
  };
}

/**
 * Real mode: bestSellers/worstSellers/mostViewed are genuinely real (real
 * OrderItem sales and real PRODUCT_VIEW events, respectively).
 * mostReturned/mostWishlisted/frequentlyBoughtTogether have no backend
 * equivalent at all (no return-reason-to-product analytics, no wishlist
 * analytics, no co-purchase aggregation exist server-side) — these come
 * back empty in real mode rather than showing mock numbers dressed up as
 * real ones; AdminProducts.tsx labels them "not yet tracked" instead of
 * silently rendering nothing.
 */
export function useProductAnalytics() {
  const orders = useUnifiedOrdersData();
  const recentlyViewedItems = useRecentlyViewedStore((s) => s.items);
  const wishlistItems = useWishlistStore((s) => s.items);

  const recentlyViewedIds = useMemo(() => recentlyViewedItems.map((i) => i.productId), [recentlyViewedItems]);
  const wishlistIds = useMemo(() => wishlistItems.map((i) => i.productId), [wishlistItems]);

  const mockBestSellers = useMemo(() => (useRealAdminApi ? [] : getBestSellers(orders)), [orders]);
  const mockWorstSellers = useMemo(() => (useRealAdminApi ? [] : getWorstSellers(orders)), [orders]);
  const mockMostReturned = useMemo(() => (useRealAdminApi ? [] : getMostReturned(orders)), [orders]);
  const mockMostViewed = useMemo(() => (useRealAdminApi ? [] : getMostViewed(recentlyViewedIds)), [recentlyViewedIds]);
  const mockMostWishlisted = useMemo(() => (useRealAdminApi ? [] : getMostWishlisted(wishlistIds)), [wishlistIds]);
  const mockFrequentlyBoughtTogether = useMemo(
    () => (useRealAdminApi ? [] : getFrequentlyBoughtTogetherPairs(orders)),
    [orders]
  );

  const { data: best } = useQuery({
    queryKey: ['admin-top-products', 'best'],
    queryFn: () => fetchAdminTopProducts('best', 8),
    enabled: useRealAdminApi,
  });
  const { data: worst } = useQuery({
    queryKey: ['admin-top-products', 'worst'],
    queryFn: () => fetchAdminTopProducts('worst', 8),
    enabled: useRealAdminApi,
  });
  const { data: mostViewedRaw } = useQuery({
    queryKey: ['admin-most-viewed'],
    queryFn: fetchAdminMostViewedProducts,
    enabled: useRealAdminApi,
  });

  const toMetric = (rows: { productId: string; name?: string; unitsSold?: number; count?: number }[]): ProductMetric[] =>
    rows.map((r) => ({ productId: r.productId, name: r.name ?? r.productId, value: r.unitsSold ?? r.count ?? 0 }));

  return {
    bestSellers: useRealAdminApi ? toMetric(best ?? []) : mockBestSellers,
    worstSellers: useRealAdminApi ? toMetric(worst ?? []) : mockWorstSellers,
    mostReturned: useRealAdminApi ? [] : mockMostReturned,
    mostViewed: useRealAdminApi ? toMetric(mostViewedRaw ?? []) : mockMostViewed,
    mostWishlisted: useRealAdminApi ? [] : mockMostWishlisted,
    frequentlyBoughtTogether: useRealAdminApi ? [] : mockFrequentlyBoughtTogether,
  };
}

/**
 * Real mode swaps activeCustomers/newCustomers/lifetimeValue (no real
 * equivalent tracked server-side) for repeatCustomers/repeatPurchaseRate
 * (genuinely real, from AnalyticsService.getCustomerStats) —
 * AdminCustomers.tsx shows different stat cards depending on mode rather
 * than forcing real data into mock-shaped fields it can't honestly fill.
 */
export function useCustomerAnalytics(): CustomerTotals & { repeatCustomers: number; repeatPurchaseRate: number } {
  const orders = useUnifiedOrdersData();
  const mock = useMemo(
    () => (useRealAdminApi ? null : getCustomerTotals(orders)),
    [orders]
  );

  const { data: overview } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => fetchAdminOverview(),
    enabled: useRealAdminApi,
  });

  const real = useMemo<CustomerTotals & { repeatCustomers: number; repeatPurchaseRate: number }>(() => {
    const totalCustomers = overview?.customers.totalCustomers ?? 0;
    const totalOrders = overview?.orders.total ?? 0;
    const revenue = overview?.revenue ?? 0;
    return {
      totalCustomers,
      activeCustomers: 0,
      newCustomers: 0,
      returningCustomers: overview?.customers.repeatCustomers ?? 0,
      averageOrderValue: totalOrders > 0 ? Math.round((revenue / totalOrders) * 100) / 100 : 0,
      lifetimeValue: 0,
      repeatCustomers: overview?.customers.repeatCustomers ?? 0,
      repeatPurchaseRate: overview?.customers.repeatPurchaseRate ?? 0,
    };
  }, [overview]);

  return useRealAdminApi ? real : { ...mock!, repeatCustomers: 0, repeatPurchaseRate: 0 };
}

/**
 * Real mode: topSearches are real terms (AnalyticsService reuses
 * SearchService.getTrending) but with no real counts to show — the
 * underlying query only ranks terms, it doesn't expose per-term counts.
 * noResultSearches/conversion have no backend equivalent (no aggregated
 * no-result/click-through tracking exists server-side) — both come back
 * empty; AdminSearch.tsx labels them "not yet tracked" in real mode.
 */
export function useSearchAnalytics() {
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const events = useSearchStore((s) => s.analyticsEvents);

  const mockTopSearches = useMemo(() => (useRealAdminApi ? [] : getTopSearches(recentSearches)), [recentSearches]);
  const mockNoResultSearches = useMemo(() => (useRealAdminApi ? [] : getNoResultSearches(events)), [events]);
  const mockConversion = useMemo(
    () => (useRealAdminApi ? { totalSearches: 0, searchesWithClick: 0, clickThroughRate: 0 } : getSearchConversion(events)),
    [events]
  );

  const { data: trending } = useQuery({
    queryKey: ['admin-trending-searches'],
    queryFn: fetchAdminTrendingSearches,
    enabled: useRealAdminApi,
  });

  const realTopSearches = useMemo<SearchTermMetric[]>(() => (trending ?? []).map((term) => ({ term, count: 0 })), [trending]);

  return {
    topSearches: useRealAdminApi ? realTopSearches : mockTopSearches,
    noResultSearches: useRealAdminApi ? [] : mockNoResultSearches,
    conversion: useRealAdminApi ? { totalSearches: 0, searchesWithClick: 0, clickThroughRate: 0 } : mockConversion,
  };
}
