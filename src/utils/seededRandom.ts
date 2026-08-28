import { hashOrderId } from '@/utils/tracking';

/**
 * mulberry32 — a small, fast, deterministic PRNG. Seeded by hashOrderId
 * (reused, not reimplemented) so callers just pass a string seed. Same
 * seed always produces the same sequence of numbers, every time — the
 * mock analytics dataset looks the same on every reload, not different
 * each time like Math.random() would give.
 */
export function createSeededRandom(seedString: string): () => number {
  let state = hashOrderId(seedString) || 1;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic integer in [min, max], inclusive. */
export function seededInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Deterministically picks one element from `items`. */
export function seededPick<T>(rand: () => number, items: T[]): T {
  return items[seededInt(rand, 0, items.length - 1)]!;
}
