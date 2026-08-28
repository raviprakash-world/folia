import { createSeededRandom, seededInt, seededPick } from '@/utils/seededRandom';
import { products } from '@/data/products';

export type MockOrderStatus = 'delivered' | 'cancelled' | 'returned' | 'processing' | 'confirmed' | 'shipped';

export interface MockHistoricalOrder {
  id: string;
  date: string;
  customerId: string;
  productIds: string[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  status: MockOrderStatus;
}

const HISTORY_DAYS = 90;
const CUSTOMER_COUNT = 140;
const SEED = 'folia-admin-baseline-v1';

const STATUS_WEIGHTS: [MockOrderStatus, number][] = [
  ['delivered', 70],
  ['shipped', 8],
  ['confirmed', 5],
  ['processing', 5],
  ['cancelled', 7],
  ['returned', 5],
];

function pickWeightedStatus(rand: () => number): MockOrderStatus {
  const total = STATUS_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [status, weight] of STATUS_WEIGHTS) {
    if (roll < weight) return status;
    roll -= weight;
  }
  return 'delivered';
}

/**
 * Generates a deterministic ~90-day baseline of mock orders across ~140
 * mock customers, seeded once at module load — every consumer in the same
 * session sees the identical dataset.
 */
function generateHistory(): MockHistoricalOrder[] {
  const rand = createSeededRandom(SEED);
  const today = new Date();
  const orders: MockHistoricalOrder[] = [];
  let orderCounter = 1;

  for (let dayOffset = HISTORY_DAYS; dayOffset >= 1; dayOffset--) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);
    const dateStr = date.toISOString().slice(0, 10);

    const dayOfWeek = date.getDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1;
    const trendBoost = 0.85 + (0.3 * (HISTORY_DAYS - dayOffset)) / HISTORY_DAYS;
    const ordersToday = Math.round(seededInt(rand, 3, 9) * weekendBoost * trendBoost);

    for (let i = 0; i < ordersToday; i++) {
      const customerId = `mock-cust-${seededInt(rand, 1, CUSTOMER_COUNT)}`;
      const itemCount = seededInt(rand, 1, 3);
      const orderProducts = Array.from({ length: itemCount }, () => seededPick(rand, products));
      const subtotal = orderProducts.reduce((sum, p) => sum + p.price, 0);
      const hasDiscount = rand() < 0.25;
      const discount = hasDiscount ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
      const shipping = subtotal >= 75 ? 0 : seededPick(rand, [6.5, 9.5]);
      const taxable = subtotal - discount;
      const tax = Math.round(taxable * 0.08 * 100) / 100;
      const total = Math.round((taxable + shipping + tax) * 100) / 100;

      orders.push({
        id: `MOCK-${String(orderCounter).padStart(5, '0')}`,
        date: dateStr,
        customerId,
        productIds: orderProducts.map((p) => p.id),
        subtotal: Math.round(subtotal * 100) / 100,
        discount,
        shipping,
        tax,
        total,
        status: pickWeightedStatus(rand),
      });
      orderCounter++;
    }
  }

  return orders;
}

export const mockHistoricalOrders: MockHistoricalOrder[] = generateHistory();
