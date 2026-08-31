export interface SimilarityProduct {
  id: string;
  category: string;
  price: number;
  careLevel?: string;
  rating?: number;
}

/** Mirrors apps/web/src/utils/recommendations.ts's scoreSimilarity exactly — category, price proximity, care-level match, rating. */
export function scoreSimilarity(
  product: SimilarityProduct,
  reference: SimilarityProduct,
): number {
  let score = 0;
  if (product.category === reference.category) score += 500;
  const priceDiff = Math.abs(product.price - reference.price);
  score += Math.max(0, 200 - priceDiff * 2);
  if (product.careLevel && product.careLevel === reference.careLevel)
    score += 100;
  score += (product.rating ?? 0) * 10;
  return score;
}

/** Ranks candidates by similarity to `reference`, highest first, ties broken by id for determinism — matching the frontend exactly. */
export function rankBySimilarity<T extends SimilarityProduct>(
  candidates: T[],
  reference: T,
  count = 4,
): T[] {
  return [...candidates]
    .filter((p) => p.id !== reference.id)
    .map((product) => ({ product, score: scoreSimilarity(product, reference) }))
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    )
    .slice(0, count)
    .map((x) => x.product);
}
