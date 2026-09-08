import { isValidGstin, isValidGstinChecksum } from './india-locale';

describe('isValidGstinChecksum', () => {
  it('accepts a real, well-known example GSTIN', () => {
    expect(isValidGstinChecksum('27AAPFU0939F1ZV')).toBe(true);
  });

  it('rejects the same GSTIN with a corrupted checksum character', () => {
    expect(isValidGstinChecksum('27AAPFU0939F1ZA')).toBe(false);
  });

  it('rejects a value that is not 15 characters', () => {
    expect(isValidGstinChecksum('27AAPFU0939F1Z')).toBe(false);
  });
});

describe('isValidGstin', () => {
  it('accepts a real, well-formed, checksum-valid GSTIN', () => {
    expect(isValidGstin('27AAPFU0939F1ZV')).toBe(true);
  });

  it('accepts the mock GSTIN this project displays on its invoice', () => {
    // apps/web/src/utils/invoice.ts's COMPANY.gstin — kept in sync
    // deliberately: even the mock value should be a genuinely valid one.
    expect(isValidGstin('29AAAAA0000A1ZY')).toBe(true);
  });

  it('rejects a structurally-plausible but checksum-invalid GSTIN', () => {
    expect(isValidGstin('29AAAAA0000A1Z5')).toBe(false);
  });

  it('rejects a value that does not match the 15-character shape', () => {
    expect(isValidGstin('not-a-gstin')).toBe(false);
  });

  it('rejects a lowercase GSTIN — the real format is uppercase-only', () => {
    expect(isValidGstin('27aapfu0939f1zv')).toBe(false);
  });
});
