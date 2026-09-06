/**
 * Ported directly from apps/web/src/utils/region.ts's isFarRegion — same
 * rough postal-code-first-digit heuristic, kept as the single source of
 * truth on this side rather than re-deriving it differently. This is now
 * ShippingService's FALLBACK ONLY (Phase 5): the real rate lookup is
 * ShiprocketProvider.checkServiceability, called first — this heuristic
 * only runs when Shiprocket isn't configured or its call fails, so the
 * public cart-page estimate endpoint never breaks over a missing courier
 * account. Works identically whether given a 5-digit or 6-digit code,
 * since it only ever reads the first digit.
 */
export function isFarRegion(postalCode: string): boolean {
  const firstDigit = Number(postalCode.charAt(0));
  return firstDigit <= 2 || firstDigit >= 8;
}
