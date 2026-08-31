import { mockHistoricalOrders } from '@/data/mockPlatformHistory';
import { products } from '@/data/products';
import { createSeededRandom, seededInt } from '@/utils/seededRandom';
import { getTrendingSearches } from '@/data/trendingSearches';
import type { Order } from '@/types/order';
import type { SearchAnalyticsEvent } from '@/store/searchStore';

interface UnifiedOrder {
  date: string;
  customerId: string;
  productIds: string[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: string;
}

function realOrderToUnified(order: Order): UnifiedOrder {
  return {
    date: order.createdAt.slice(0, 10),
    customerId: 'you',
    productIds: order.items.map((i) => i.productId),
    subtotal: order.subtotal,
    discount: order.discount,
    shipping: order.shippingCost,
    total: order.total,
    status: order.status,
  };
}

/**
 * Combines the deterministic mock baseline with real live orders from this
 * session's orderStore. This is the one join point every metric below goes
 * through — a real order placed in the demo genuinely shows up in every
 * chart derived from this list.
 */
export function getUnifiedOrders(liveOrders: Order[]): UnifiedOrder[] {
  return [...mockHistoricalOrders.map((o) => ({ ...o })), ...liveOrders.map(realOrderToUnified)];
}

function dateRangeDays(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export type RevenueGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RevenuePoint {
  label: string;
  gross: number;
  net: number;
  discounts: number;
  shipping: number;
}

function bucketKeyForGranularity(dateStr: string, granularity: RevenueGranularity): string {
  const date = new Date(dateStr);
  if (granularity === 'daily') return dateStr;
  if (granularity === 'weekly') {
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    return monday.toISOString().slice(0, 10);
  }
  if (granularity === 'monthly') return dateStr.slice(0, 7);
  return dateStr.slice(0, 4);
}

export function getRevenueSeries(orders: UnifiedOrder[], granularity: RevenueGranularity, windowDays = 90): RevenuePoint[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const relevant = orders.filter((o) => o.date >= cutoffStr && o.status !== 'cancelled');
  const buckets = new Map<string, RevenuePoint>();

  for (const order of relevant) {
    const key = bucketKeyForGranularity(order.date, granularity);
    const existing = buckets.get(key) ?? { label: key, gross: 0, net: 0, discounts: 0, shipping: 0 };
    existing.gross += order.subtotal;
    existing.net += order.total - order.shipping;
    existing.discounts += order.discount;
    existing.shipping += order.shipping;
    buckets.set(key, existing);
  }

  return [...buckets.values()]
    .map((p) => ({
      label: p.label,
      gross: Math.round(p.gross * 100) / 100,
      net: Math.round(p.net * 100) / 100,
      discounts: Math.round(p.discounts * 100) / 100,
      shipping: Math.round(p.shipping * 100) / 100,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface RevenueTotals {
  grossRevenue: number;
  netRevenue: number;
  totalDiscounts: number;
  shippingRevenue: number;
}

export function getRevenueTotals(orders: UnifiedOrder[], windowDays = 90): RevenueTotals {
  const series = getRevenueSeries(orders, 'daily', windowDays);
  return series.reduce(
    (acc, p) => ({
      grossRevenue: acc.grossRevenue + p.gross,
      netRevenue: acc.netRevenue + p.net,
      totalDiscounts: acc.totalDiscounts + p.discounts,
      shippingRevenue: acc.shippingRevenue + p.shipping,
    }),
    { grossRevenue: 0, netRevenue: 0, totalDiscounts: 0, shippingRevenue: 0 }
  );
}

export interface OrdersPerDayPoint {
  label: string;
  count: number;
}

export function getOrdersPerDay(orders: UnifiedOrder[], days = 30): OrdersPerDayPoint[] {
  const dates = dateRangeDays(days);
  const counts = new Map<string, number>();
  for (const order of orders) counts.set(order.date, (counts.get(order.date) ?? 0) + 1);
  return dates.map((date) => ({ label: date, count: counts.get(date) ?? 0 }));
}

export interface StatusBreakdown {
  status: string;
  count: number;
}

export function getOrdersByStatus(orders: UnifiedOrder[], windowDays = 90): StatusBreakdown[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const relevant = orders.filter((o) => o.date >= cutoffStr);
  const counts = new Map<string, number>();
  for (const o of relevant) counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, count]) => ({ status, count }));
}

export interface OrderPerformance {
  deliveryRate: number;
  cancellationRate: number;
  returnRate: number;
  totalOrders: number;
}

export function getOrderPerformance(orders: UnifiedOrder[], windowDays = 90): OrderPerformance {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const relevant = orders.filter((o) => o.date >= cutoffStr);
  const total = relevant.length || 1;

  const delivered = relevant.filter((o) => o.status === 'delivered').length;
  const cancelled = relevant.filter((o) => o.status === 'cancelled').length;
  const returned = relevant.filter((o) => o.status === 'returned').length;

  return {
    deliveryRate: Math.round((delivered / total) * 1000) / 10,
    cancellationRate: Math.round((cancelled / total) * 1000) / 10,
    returnRate: Math.round((returned / total) * 1000) / 10,
    totalOrders: relevant.length,
  };
}

export interface ProductMetric {
  productId: string;
  name: string;
  value: number;
}

export function getBestSellers(orders: UnifiedOrder[], count = 8): ProductMetric[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const id of o.productIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([productId, value]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? productId, value }))
    .sort((a, b) => b.value - a.value || a.productId.localeCompare(b.productId))
    .slice(0, count);
}

export function getWorstSellers(orders: UnifiedOrder[], count = 8): ProductMetric[] {
  const counts = new Map<string, number>(products.map((p) => [p.id, 0]));
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    for (const id of o.productIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([productId, value]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? productId, value }))
    .sort((a, b) => a.value - b.value || a.productId.localeCompare(b.productId))
    .slice(0, count);
}

export function getMostReturned(orders: UnifiedOrder[], count = 6): ProductMetric[] {
  const counts = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== 'returned') continue;
    for (const id of o.productIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([productId, value]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? productId, value }))
    .sort((a, b) => b.value - a.value || a.productId.localeCompare(b.productId))
    .slice(0, count);
}

/**
 * "Most Viewed" and "Most Wishlisted" need aggregate multi-customer signal
 * this client-only app doesn't have — a deterministic mock baseline per
 * product, seeded once, with the current session's real recently-viewed/
 * wishlist activity added on top so the numbers genuinely move as you use
 * the app, same principle as orders/revenue above.
 */
function seededProductBaseline(seedPrefix: string, min: number, max: number): Map<string, number> {
  const rand = createSeededRandom(seedPrefix);
  const map = new Map<string, number>();
  for (const p of products) map.set(p.id, seededInt(rand, min, max));
  return map;
}

export function getMostViewed(realRecentlyViewedIds: string[], count = 8): ProductMetric[] {
  const baseline = seededProductBaseline('folia-admin-views-v1', 20, 400);
  for (const id of realRecentlyViewedIds) baseline.set(id, (baseline.get(id) ?? 0) + 1);
  return [...baseline.entries()]
    .map(([productId, value]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? productId, value }))
    .sort((a, b) => b.value - a.value || a.productId.localeCompare(b.productId))
    .slice(0, count);
}

export function getMostWishlisted(realWishlistIds: string[], count = 8): ProductMetric[] {
  const baseline = seededProductBaseline('folia-admin-wishlist-v1', 5, 120);
  for (const id of realWishlistIds) baseline.set(id, (baseline.get(id) ?? 0) + 1);
  return [...baseline.entries()]
    .map(([productId, value]) => ({ productId, name: products.find((p) => p.id === productId)?.name ?? productId, value }))
    .sort((a, b) => b.value - a.value || a.productId.localeCompare(b.productId))
    .slice(0, count);
}

export interface ProductPairMetric {
  pair: [string, string];
  count: number;
}

/**
 * Real co-occurrence analysis — which products actually appear together in
 * the same order across the combined order history. Distinct from (and a
 * genuine complement to) the deterministic recommendation engine's
 * category-chain "Frequently Bought Together" — this counts actual
 * co-purchases in the data rather than applying a fixed category rule.
 */
export function getFrequentlyBoughtTogetherPairs(orders: UnifiedOrder[], count = 6): ProductPairMetric[] {
  const pairCounts = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'cancelled' || o.productIds.length < 2) continue;
    const unique = [...new Set(o.productIds)];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i]!;
        const b = unique[j]!;
        const key = [a, b].sort().join('::');
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...pairCounts.entries()]
    .map(([key, count]) => {
      const [a, b] = key.split('::') as [string, string];
      return { pair: [a, b] as [string, string], count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, count);
}

export interface CustomerTotals {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  averageOrderValue: number;
  lifetimeValue: number;
}

export function getCustomerTotals(orders: UnifiedOrder[]): CustomerTotals {
  const byCustomer = new Map<string, UnifiedOrder[]>();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const list = byCustomer.get(o.customerId) ?? [];
    list.push(o);
    byCustomer.set(o.customerId, list);
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffStr = thirtyDaysAgo.toISOString().slice(0, 10);

  let active = 0;
  let newCustomers = 0;
  let returning = 0;
  let totalSpend = 0;
  let orderCount = 0;

  for (const [, customerOrders] of byCustomer) {
    const sorted = [...customerOrders].sort((a, b) => a.date.localeCompare(b.date));
    const firstOrderDate = sorted[0]!.date;
    if (sorted.some((o) => o.date >= cutoffStr)) active++;
    if (firstOrderDate >= cutoffStr) newCustomers++;
    if (customerOrders.length > 1) returning++;
    totalSpend += customerOrders.reduce((sum, o) => sum + o.total, 0);
    orderCount += customerOrders.length;
  }

  const totalCustomers = byCustomer.size;
  const averageOrderValue = orderCount > 0 ? totalSpend / orderCount : 0;
  // Mock LTV: average total spend per customer, projected over a modest
  // illustrative retention multiplier — not a real cohort-based LTV model.
  const avgSpendPerCustomer = totalCustomers > 0 ? totalSpend / totalCustomers : 0;
  const lifetimeValue = avgSpendPerCustomer * 1.8;

  return {
    totalCustomers,
    activeCustomers: active,
    newCustomers,
    returningCustomers: returning,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    lifetimeValue: Math.round(lifetimeValue * 100) / 100,
  };
}

export interface SearchTermMetric {
  term: string;
  count: number;
}

/** Deterministic mock baseline search frequency + this session's real recent searches added on top. */
export function getTopSearches(realRecentSearches: string[], count = 8): SearchTermMetric[] {
  const pool = [...getTrendingSearches(), 'watering can', 'terracotta', 'monstera', 'fiddle leaf'];
  const rand = createSeededRandom('folia-admin-search-baseline-v1');
  const baseline = new Map<string, number>(pool.map((term) => [term, seededInt(rand, 15, 250)]));
  for (const term of realRecentSearches) baseline.set(term, (baseline.get(term) ?? 0) + 5);
  return [...baseline.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, count);
}

export function getNoResultSearches(events: SearchAnalyticsEvent[], count = 8): SearchTermMetric[] {
  const noResult = events.filter((e) => e.resultCount === 0);
  const counts = new Map<string, number>();
  for (const e of noResult) counts.set(e.query, (counts.get(e.query) ?? 0) + 1);
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, count);
}

export interface SearchConversion {
  totalSearches: number;
  searchesWithClick: number;
  clickThroughRate: number;
}

/** Real click-through rate from actual logged search events — not a fabricated conversion number. */
export function getSearchConversion(events: SearchAnalyticsEvent[]): SearchConversion {
  const total = events.length;
  const withClick = events.filter((e) => !!e.clickedResultId).length;
  return {
    totalSearches: total,
    searchesWithClick: withClick,
    clickThroughRate: total > 0 ? Math.round((withClick / total) * 1000) / 10 : 0,
  };
}
