const TRENDING_POOL = [
  'Indoor Plants',
  'Snake Plant',
  'Ceramic Pots',
  'Gifts',
  'Air Purifying Plants',
  'Balcony Plants',
  'Succulents',
  'Low Light Plants',
  'Fiddle Leaf Fig',
  'Plant Stands',
];

const VISIBLE_COUNT = 6;
const ROTATION_PERIOD_DAYS = 3;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diffMs = date.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Deterministic rotation: which slice of the pool is shown depends only on
 * the date, via a fixed formula — not Math.random(). Advances every
 * ROTATION_PERIOD_DAYS days, wrapping around the pool.
 */
export function getTrendingSearches(date: Date = new Date()): string[] {
  const period = Math.floor(dayOfYear(date) / ROTATION_PERIOD_DAYS);
  const start = period % TRENDING_POOL.length;
  const rotated = [...TRENDING_POOL.slice(start), ...TRENDING_POOL.slice(0, start)];
  return rotated.slice(0, VISIBLE_COUNT);
}
