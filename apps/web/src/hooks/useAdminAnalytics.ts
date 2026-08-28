import { useMemo } from 'react';
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
import type { RevenueGranularity } from '@/utils/analytics';

/** The one join point every admin hook below builds on — real live orders merged with the deterministic mock baseline. */
function useUnifiedOrdersData() {
  const liveOrders = useOrderStore((s) => s.orders);
  return useMemo(() => getUnifiedOrders(liveOrders), [liveOrders]);
}

export function useRevenueAnalytics(granularity: RevenueGranularity, windowDays = 90) {
  const orders = useUnifiedOrdersData();
  const series = useMemo(() => getRevenueSeries(orders, granularity, windowDays), [orders, granularity, windowDays]);
  const totals = useMemo(() => getRevenueTotals(orders, windowDays), [orders, windowDays]);

  // Real period-over-period comparison: this window's total vs. the equal-length window immediately before it.
  const previousTotals = useMemo(() => {
    const allSeries = getRevenueSeries(orders, 'daily', windowDays * 2);
    const cutoff = allSeries.length - Math.min(allSeries.length, Math.round(allSeries.length / 2));
    const previousWindow = allSeries.slice(0, cutoff);
    return previousWindow.reduce((sum, p) => sum + p.gross, 0);
  }, [orders, windowDays]);

  const revenueTrend = useMemo<{ value: number; direction: 'up' | 'down' } | null>(() => {
    if (previousTotals <= 0) return null;
    const change = ((totals.grossRevenue - previousTotals) / previousTotals) * 100;
    return { value: Math.round(Math.abs(change) * 10) / 10, direction: change >= 0 ? 'up' : 'down' };
  }, [totals.grossRevenue, previousTotals]);

  return { series, totals, revenueTrend };
}

export function useOrdersAnalytics(days = 30, windowDays = 90) {
  const orders = useUnifiedOrdersData();
  const perDay = useMemo(() => getOrdersPerDay(orders, days), [orders, days]);
  const byStatus = useMemo(() => getOrdersByStatus(orders, windowDays), [orders, windowDays]);
  const performance = useMemo(() => getOrderPerformance(orders, windowDays), [orders, windowDays]);
  return { perDay, byStatus, performance };
}

export function useProductAnalytics() {
  const orders = useUnifiedOrdersData();
  const recentlyViewedItems = useRecentlyViewedStore((s) => s.items);
  const wishlistItems = useWishlistStore((s) => s.items);

  const recentlyViewedIds = useMemo(() => recentlyViewedItems.map((i) => i.productId), [recentlyViewedItems]);
  const wishlistIds = useMemo(() => wishlistItems.map((i) => i.productId), [wishlistItems]);

  const bestSellers = useMemo(() => getBestSellers(orders), [orders]);
  const worstSellers = useMemo(() => getWorstSellers(orders), [orders]);
  const mostReturned = useMemo(() => getMostReturned(orders), [orders]);
  const mostViewed = useMemo(() => getMostViewed(recentlyViewedIds), [recentlyViewedIds]);
  const mostWishlisted = useMemo(() => getMostWishlisted(wishlistIds), [wishlistIds]);
  const frequentlyBoughtTogether = useMemo(() => getFrequentlyBoughtTogetherPairs(orders), [orders]);

  return { bestSellers, worstSellers, mostReturned, mostViewed, mostWishlisted, frequentlyBoughtTogether };
}

export function useCustomerAnalytics() {
  const orders = useUnifiedOrdersData();
  return useMemo(() => getCustomerTotals(orders), [orders]);
}

export function useSearchAnalytics() {
  const recentSearches = useSearchStore((s) => s.recentSearches);
  const events = useSearchStore((s) => s.analyticsEvents);

  const topSearches = useMemo(() => getTopSearches(recentSearches), [recentSearches]);
  const noResultSearches = useMemo(() => getNoResultSearches(events), [events]);
  const conversion = useMemo(() => getSearchConversion(events), [events]);

  return { topSearches, noResultSearches, conversion };
}
