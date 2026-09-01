import * as argon2 from 'argon2';

/**
 * Argon2id — the OWASP-recommended variant (resistant to both GPU
 * cracking and side-channel attacks, unlike argon2i/argon2d alone).
 * Parameters follow OWASP's current minimum recommendation for argon2id:
 * 19 MiB memory, 2 iterations, 1 degree of parallelism.
 *
 * `type: argon2.argon2id` — note HashOptions#type is numeric
 * (`keyof typeof names`, i.e. 0 | 1 | 2), not a string literal; verified
 * against this package's actual shipped .d.cts rather than assumed from
 * memory, after an earlier version of this file referenced a nonexistent
 * `argon2.Options` type that doesn't exist in the installed version.
 */
const HASH_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, HASH_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // argon2.verify throws on a malformed/foreign hash (e.g. a hash from
    // a different algorithm) rather than returning false — treat that
    // the same as "doesn't match" rather than letting it become a 500.
    return false;
  }
}
