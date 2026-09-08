/**
 * Rough Indian-PIN-code region proxy shared by the cart's shipping
 * estimate, checkout's delivery-method availability, and the address
 * book's mock "delivery availability" check — one heuristic, three
 * consumers, not three copies of the same digit check. India Post's PIN
 * zones run 1-8 by region (9 is army post), so the same first-digit
 * split this used before (written for 5-digit US ZIPs, which happen to
 * share the "first digit = region" shape) still applies unchanged to a
 * 6-digit PIN.
 */
export function isFarRegion(postalCode: string): boolean {
  const firstDigit = Number(postalCode.charAt(0));
  return firstDigit <= 2 || firstDigit >= 8;
}

// P0-F — this app now only offers India as a country (see
// data/countries.ts), so the 4 other patterns this used to carry
// (US/CA/GB/AU) were dead code — every one of them, if it were ever
// reachable, would go on to fail the real backend's IsIn(['IN'])
// country check anyway.
const INDIA_PIN_CODE_PATTERN = /^[1-9][0-9]{5}$/;

/** A real Indian PIN code never starts with 0. */
export function isValidPostalCode(postalCode: string): boolean {
  return INDIA_PIN_CODE_PATTERN.test(postalCode.trim());
}
