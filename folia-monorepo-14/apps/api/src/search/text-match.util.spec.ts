import {
  findDidYouMean,
  getMatchQuality,
  sortByRelevance,
} from './text-match.util';

describe('getMatchQuality', () => {
  it('classifies exact, prefix, contains, and none correctly', () => {
    expect(getMatchQuality('Monstera', 'monstera')).toBe('exact'); // case-insensitive
    expect(getMatchQuality('Monstera Deliciosa', 'monst')).toBe('prefix');
    expect(getMatchQuality('Ceramic Monstera Pot', 'monstera')).toBe(
      'contains',
    );
    expect(getMatchQuality('Snake Plant', 'monstera')).toBe('none');
  });

  it('treats an empty query as no match, never a false exact/prefix', () => {
    expect(getMatchQuality('Monstera', '')).toBe('none');
    expect(getMatchQuality('Monstera', '   ')).toBe('none');
  });
});

describe('sortByRelevance', () => {
  it('orders exact > prefix > contains, and excludes non-matches entirely', () => {
    const items = [
      'Snake Plant',
      'Monstera Deliciosa',
      'monstera',
      'Ceramic Monstera Pot',
    ];
    const result = sortByRelevance(items, 'monstera', (s) => s);
    expect(result).toEqual([
      'monstera',
      'Monstera Deliciosa',
      'Ceramic Monstera Pot',
    ]);
  });
});

describe('findDidYouMean', () => {
  it('returns null for queries under 3 characters, regardless of candidates', () => {
    expect(findDidYouMean('mo', ['monstera'])).toBeNull();
  });

  it('returns null when the query already matches something (no correction needed)', () => {
    expect(findDidYouMean('monst', ['monstera deliciosa'])).toBeNull();
  });

  it('suggests a close term within the edit-distance threshold for a short query', () => {
    // "monstara" vs "monstera" — 1 character substitution, threshold 1 for queries <=5 chars... but this is 8 chars, so threshold 2.
    expect(findDidYouMean('monstara', ['monstera'])).toBe('monstera');
  });

  it('suggests nothing when no candidate is close enough', () => {
    expect(
      findDidYouMean('xyzabc', ['monstera', 'succulent', 'fern']),
    ).toBeNull();
  });

  it('picks the closest of multiple plausible candidates', () => {
    // "suculent" is 1 edit from "succulent", further from "succulents" (2 edits, extra letter)
    expect(
      findDidYouMean('suculent', ['succulent', 'succulents', 'monstera']),
    ).toBe('succulent');
  });

  it('applies a stricter threshold (1) for short queries and a looser one (2) for longer ones', () => {
    // 5-char query, 2 edits away — should NOT match (threshold 1 for len<=5)
    expect(findDidYouMean('ffffx', ['aaaaa'])).toBeNull();
    // Confirm a genuinely 1-edit-away short query DOES match
    expect(findDidYouMean('fernn', ['fern'])).toBe('fern');
  });
});
