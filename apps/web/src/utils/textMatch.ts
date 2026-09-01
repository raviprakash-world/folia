export interface HighlightRange {
  text: string;
  matched: boolean;
}

/** Splits `text` into matched/unmatched ranges around the first case-insensitive occurrence of `query`. */
export function getHighlightRanges(text: string, query: string): HighlightRange[] {
  if (!query.trim()) return [{ text, matched: false }];
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return [{ text, matched: false }];
  return [
    { text: text.slice(0, index), matched: false },
    { text: text.slice(index, index + query.length), matched: true },
    { text: text.slice(index + query.length), matched: false },
  ].filter((r) => r.text.length > 0);
}

export type MatchQuality = 'exact' | 'prefix' | 'contains' | 'none';

export function getMatchQuality(text: string, query: string): MatchQuality {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 'none';
  if (t === q) return 'exact';
  if (t.startsWith(q)) return 'prefix';
  if (t.includes(q)) return 'contains';
  return 'none';
}

const matchQualityWeight: Record<MatchQuality, number> = { exact: 3, prefix: 2, contains: 1, none: 0 };

/** Simple relevance sort for small datasets (categories, collections, blog posts) — exact > prefix > contains. */
export function sortByRelevance<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  return [...items]
    .map((item) => ({ item, weight: matchQualityWeight[getMatchQuality(getText(item), query)] }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((x) => x.item);
}

/** Real Levenshtein edit distance — small strings only (search terms). */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[m]![n]!;
}

/**
 * "Did you mean?" — finds the closest term to `query` among `candidates`
 * within a small edit-distance threshold (scaled to query length). Returns
 * null if nothing is close enough, or if the query already matches
 * something (no correction needed).
 */
export function findDidYouMean(query: string, candidates: string[]): string | null {
  const q = query.toLowerCase().trim();
  if (!q || q.length < 3) return null;
  if (candidates.some((c) => c.toLowerCase().includes(q))) return null;

  const threshold = q.length <= 5 ? 1 : 2;
  let best: { term: string; distance: number } | null = null;

  for (const candidate of candidates) {
    const distance = editDistance(q, candidate.toLowerCase());
    if (distance <= threshold && (!best || distance < best.distance)) {
      best = { term: candidate, distance };
    }
  }

  return best?.term ?? null;
}
