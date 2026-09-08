import { registerDecorator } from 'class-validator';

/**
 * P0-F — India-commerce correctness. Shared, not duplicated per-DTO: the
 * shipping-estimate DTO already had its own inline `/^\d{6}$/` PIN check
 * (estimate-shipping.dto.ts) while every other address-collecting DTO
 * (customer address book, seller business address) had none at all —
 * `postalCode` was `@IsString() @MinLength(1)`, meaning "any non-empty
 * string" reached ShiprocketProvider's `billing_pincode`, which requires
 * a real Indian PIN. This is the single source of truth going forward.
 *
 * A real Indian PIN code never starts with 0 (India Post's postal zones
 * are 1-8 by region, 9 for army post) — stricter than a bare `\d{6}`.
 */
export const INDIA_PIN_CODE_PATTERN = /^[1-9][0-9]{5}$/;
export const INDIA_PIN_CODE_MESSAGE = 'Enter a valid 6-digit PIN code.';

/**
 * GSTIN — 15 chars: 2-digit state code, 10-char PAN
 * ([A-Z]{5}[0-9]{4}[A-Z]{1}), 1-char entity number, literal 'Z', 1-char
 * checksum. This is a real, publicly documented GST-council format —
 * not a business-policy choice — so both the shape AND the checksum are
 * worth validating for real (a shape-only regex would accept a
 * plausible-looking but invalid GSTIN).
 */
export const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const GSTIN_MESSAGE = 'Enter a valid 15-character GSTIN.';

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * The real GST-council checksum algorithm (a mod-36 check digit over the
 * first 14 characters) — publicly documented, not reverse-engineered.
 * Validates the 15th character against it. Assumes `gstin` already
 * passed GSTIN_PATTERN (14 well-formed characters expected here).
 */
export function isValidGstinChecksum(gstin: string): boolean {
  if (gstin.length !== 15) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const charValue = GSTIN_CHARSET.indexOf(gstin[i]);
    if (charValue === -1) return false;
    const factor = i % 2 === 0 ? 1 : 2;
    const product = charValue * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checksumIndex = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checksumIndex] === gstin[14];
}

/** Full GSTIN validation: shape (GSTIN_PATTERN) + real checksum, both required. */
export function isValidGstin(value: string): boolean {
  return GSTIN_PATTERN.test(value) && isValidGstinChecksum(value);
}

/**
 * DTO-usable decorator — shape and checksum together, one clear error
 * message either way (deliberately not distinguishing "bad shape" from
 * "bad checksum" to a client: neither is actionable beyond "check what
 * you typed").
 */
export function IsGstin() {
  return function (target: object, propertyKey: string) {
    registerDecorator({
      name: 'isGstin',
      target: target.constructor,
      propertyName: propertyKey,
      options: { message: GSTIN_MESSAGE },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidGstin(value);
        },
      },
    });
  };
}
