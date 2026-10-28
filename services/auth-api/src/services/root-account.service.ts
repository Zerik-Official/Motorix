/**
 * @file Seeding of the single `root` account from the environment of the service.
 */

import { ConflictError } from "../core/errors";
import type { PasswordHasher } from "../core/security/password-hasher";
import type { UserChanges, UserRecord, UserRepository } from "../repositories/user.repository";

/**
 * Credentials of `root`, taken from `ROOT_EMAIL`, `ROOT_PASSWORD` and `ROOT_FULL_NAME`.
 */
export interface RootCredentials {
  email: string;
  password: string;
  fullName: string;
}

/**
 * What the seeding did to the `root` account.
 */
export type RootSeedResult = "created" | "updated" | "unchanged";

/**
 * Keeps the `root` account in line with the environment, which is its only source of truth.
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
   * Creates `root` on the first start and, on later starts, applies any change made to its
   * credentials in the environment and reactivates it.
   *
   * @param credentials - Credentials of `root`.
   * @returns Whether the account was created, updated or left unchanged.
   * @throws ConflictError When another account already uses the email of `root`.
   */
  async ensureRoot(credentials: RootCredentials): Promise<RootSeedResult> {
    const email: string = credentials.email.trim().toLowerCase();
    const owner: UserRecord | null = await this.users.findByEmail(email);
    if (owner !== null && owner.role !== "root") {
      throw new ConflictError(`The email of root is already used by another account: ${email}`);
    }
    const root: UserRecord | null = await this.users.findRoot();
    if (root === null) {
      await this.users.create({
        email,
        fullName: credentials.fullName,
        passwordHash: await this.hasher.hash(credentials.password),
        role: "root",
      });
      return "created";
    }
    const changes: UserChanges = {};
    if (root.email !== email) {
      changes.email = email;
    }
    if (root.fullName !== credentials.fullName) {
      changes.fullName = credentials.fullName;
    }
    if (!root.isActive) {
      changes.isActive = true;
    }
    if (!(await this.hasher.verify(credentials.password, root.passwordHash))) {
      changes.passwordHash = await this.hasher.hash(credentials.password);
    }
    if (Object.keys(changes).length === 0) {
      return "unchanged";
    }
    await this.users.update(root.id, changes);
    return "updated";
  }
}
