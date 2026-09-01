/**
 * Ported directly from apps/web/src/utils/region.ts's isFarRegion — same
 * rough US-ZIP-first-digit heuristic, kept as the single source of truth
 * on this side rather than re-deriving it differently. A real carrier
 * rate API is out of scope here for the same reason it was out of scope
 * for the frontend's mock: this project's rate logic was always a
 * placeholder, not a specification to exceed.
 */
export function isFarRegion(postalCode: string): boolean {
  const firstDigit = Number(postalCode.charAt(0));
  return firstDigit <= 2 || firstDigit >= 8;
}
