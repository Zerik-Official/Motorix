/**
 * @file Creation of the single `root` account from the environment on the first start.
 */

import { ConflictError } from "../core/errors";
import type { PasswordHasher } from "../core/security/password-hasher";
import type { UserRepository } from "../repositories/user.repository";

/**
 * Credentials `root` is created with, taken from `ROOT_EMAIL`, `ROOT_PASSWORD` and `ROOT_FULL_NAME`.
 */
export interface RootCredentials {
  email: string;
  password: string;
  fullName: string;
}

/**
 * What the seeding did: created `root`, or found it already there and left it as it is.
 */
export type RootSeedResult = "created" | "existing";

/**
 * Creates the `root` account the first time the service starts. The environment only bootstraps
 * it: afterwards `root` changes its own password through `PUT /api/v1/users/me/password`, and later
 * changes to `ROOT_*` have no effect, so the password does not have to stay in the environment.
 */
export class RootAccountService {
  /**
   * @param users - Account storage.
   * @param hasher - Password hasher.
   */
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  /**
   * Creates `root` from the environment when it does not exist yet; an existing `root` is never
   * changed.
   *
   * @param credentials - Credentials of `root`.
   * @returns Whether the account was created or already existed.
   * @throws ConflictError When `root` does not exist and another account already uses its email.
   */
  async ensureRoot(credentials: RootCredentials): Promise<RootSeedResult> {
    if ((await this.users.findRoot()) !== null) {
      return "existing";
    }
    const email: string = credentials.email.trim().toLowerCase();
    if ((await this.users.findByEmail(email)) !== null) {
      throw new ConflictError(`The email of root is already used by another account: ${email}`);
    }
    await this.users.create({
      email,
      fullName: credentials.fullName,
      passwordHash: await this.hasher.hash(credentials.password),
      role: "root",
    });
    return "created";
  }
}
