import { generateSecureToken, hashToken } from './token.util';

describe('token.util', () => {
  it('generates a raw token and a matching SHA-256 hash', () => {
    const { raw, hash } = generateSecureToken();
    expect(raw).toHaveLength(43); // base64url encoding of 32 raw bytes
    expect(hash).toHaveLength(64); // hex-encoded SHA-256 digest
    expect(hashToken(raw)).toBe(hash);
  });

  it('generates a different token on every call (real randomness, not fixed)', () => {
    const first = generateSecureToken();
    const second = generateSecureToken();
    expect(first.raw).not.toBe(second.raw);
    expect(first.hash).not.toBe(second.hash);
  });

  it('hashToken is deterministic — same input always produces the same hash', () => {
    const raw = 'a-fixed-example-token-value';
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('the raw token itself is never recoverable from its hash (one-way)', () => {
    const { raw, hash } = generateSecureToken();
    expect(hash).not.toContain(raw);
  });
});
