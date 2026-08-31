import { rankBySimilarity, scoreSimilarity } from './similarity.util';
import type { SimilarityProduct } from './similarity.util';

function makeProduct(
  overrides: Partial<SimilarityProduct> = {},
): SimilarityProduct {
  return {
    id: 'a',
    category: 'plants',
    price: 50,
    careLevel: 'easy',
    rating: 4,
    ...overrides,
  };
}

describe('scoreSimilarity', () => {
  it('gives a same-category bonus', () => {
    const reference = makeProduct({ category: 'plants' });
    const sameCategory = scoreSimilarity(
      makeProduct({ category: 'plants' }),
      reference,
    );
    const differentCategory = scoreSimilarity(
      makeProduct({ category: 'tools' }),
      reference,
    );
    expect(sameCategory).toBeGreaterThan(differentCategory);
  });

  it('scores closer prices higher, but never below zero contribution', () => {
    const reference = makeProduct({ price: 50 });
    const close = scoreSimilarity(makeProduct({ price: 55 }), reference);
    const far = scoreSimilarity(makeProduct({ price: 500 }), reference);
    expect(close).toBeGreaterThan(far);
  });

  it('gives a bonus for a matching care level', () => {
    const reference = makeProduct({ careLevel: 'easy' });
    const matching = scoreSimilarity(
      makeProduct({ careLevel: 'easy' }),
      reference,
    );
    const different = scoreSimilarity(
      makeProduct({ careLevel: 'advanced' }),
      reference,
    );
    expect(matching).toBeGreaterThan(different);
  });

  it('factors in rating as a real contribution', () => {
    const reference = makeProduct();
    const highRated = scoreSimilarity(makeProduct({ rating: 5 }), reference);
    const lowRated = scoreSimilarity(makeProduct({ rating: 1 }), reference);
    expect(highRated - lowRated).toBe(4 * 10);
  });
});

describe('rankBySimilarity', () => {
  it('excludes the reference product itself from its own results', () => {
    const reference = makeProduct({ id: 'ref' });
    const candidates = [reference, makeProduct({ id: 'other' })];
    const result = rankBySimilarity(candidates, reference);
    expect(result.some((p) => p.id === 'ref')).toBe(false);
  });

  it('orders highest score first', () => {
    const reference = makeProduct({ id: 'ref', category: 'plants', price: 50 });
    const candidates = [
      makeProduct({ id: 'far', category: 'tools', price: 500 }),
      makeProduct({ id: 'close', category: 'plants', price: 52 }),
    ];
    const result = rankBySimilarity(candidates, reference);
    expect(result[0]?.id).toBe('close');
  });

  it('respects the count limit', () => {
    const reference = makeProduct({ id: 'ref' });
    const candidates = Array.from({ length: 10 }, (_, i) =>
      makeProduct({ id: `p${i}` }),
    );
    expect(rankBySimilarity(candidates, reference, 3)).toHaveLength(3);
  });
});
