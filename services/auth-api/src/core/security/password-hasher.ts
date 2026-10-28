/**
 * @file Password hashing with Argon2id, built into the Bun runtime.
 */

/**
 * Hashes and verifies passwords; plain passwords are never stored or logged.
 */
export class PasswordHasher {
  /**
   * @param memoryCost - Memory used per hash, in KiB.
   * @param timeCost - Number of passes over the memory.
   */
  constructor(
    private readonly memoryCost: number = 19456,
    private readonly timeCost: number = 2,
  ) {}

  /**
   * Hashes a password with a random salt.
   *
   * @param password - Plain password.
   * @returns The encoded Argon2id hash, which embeds its salt and parameters.
   */
  hash(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: "argon2id",
      memoryCost: this.memoryCost,
      timeCost: this.timeCost,
    });
  }

  /**
   * Checks a password against a stored hash.
   *
   * @param password - Plain password.
   * @param hash - Stored Argon2id hash.
   * @returns True when the password matches.
   */
  async verify(password: string, hash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, hash);
    } catch {
      return false;
    }
  }
}
