/**
 * Rough US-ZIP-code region proxy shared by the cart's shipping estimate,
 * checkout's delivery-method availability, and the address book's mock
 * "delivery availability" check — one heuristic, three consumers, not three
 * copies of the same digit check.
 */
export function isFarRegion(postalCode: string): boolean {
  const firstDigit = Number(postalCode.charAt(0));
  return firstDigit <= 2 || firstDigit >= 8;
}

const POSTAL_PATTERNS: Record<string, RegExp> = {
  US: /^\d{5}$/,
  CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
  GB: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
  IN: /^\d{6}$/,
  AU: /^\d{4}$/,
};

/**
 * Deliberately simplified — real postal-code validation needs a maintained
 * per-country library. This covers the 5 countries offered in the address
 * form well enough for a demo, and falls back to "non-empty" for anything else.
 */
export function isValidPostalCode(postalCode: string, countryCode: string): boolean {
  const pattern = POSTAL_PATTERNS[countryCode];
  if (!pattern) return postalCode.trim().length > 0;
  return pattern.test(postalCode.trim());
}
