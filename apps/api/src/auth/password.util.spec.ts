import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes a password to something that is not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toBe('correct horse battery staple');
    expect(hash).toMatch(/^\$argon2id\$/);
  });

  it('verifies a correct password against its own hash', async () => {
    const hash = await hashPassword('my-real-password-123');
    expect(await verifyPassword(hash, 'my-real-password-123')).toBe(true);
  });

  it('rejects an incorrect password against a real hash', async () => {
    const hash = await hashPassword('my-real-password-123');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('produces a different hash for the same password each time (real salting)', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
    // Both must still verify correctly despite being different strings.
    expect(await verifyPassword(hashA, 'same-password')).toBe(true);
    expect(await verifyPassword(hashB, 'same-password')).toBe(true);
  });

  it('does not throw and simply returns false for a malformed/foreign hash', async () => {
    await expect(
      verifyPassword('not-a-real-argon2-hash', 'anything'),
    ).resolves.toBe(false);
  });
});
