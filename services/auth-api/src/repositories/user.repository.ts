/**
 * @file Data access for the `users` table.
 */

import type { PrismaClient } from "../generated/prisma/client";
import type { Role } from "../core/security/roles";

/**
 * Account stored in `users`.
 */
export interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data required to create an account.
 */
export interface NewUser {
  email: string;
  fullName: string;
  passwordHash: string;
  role: Role;
}

/**
 * Fields of an account that can change.
 */
export type UserChanges = Partial<Pick<UserRecord, "email" | "fullName" | "passwordHash" | "role" | "isActive">>;

/**
 * Reads and writes accounts.
 */
export interface UserRepository {
  /**
   * @param email - Normalized email.
   * @returns The account with that email, or null.
   */
  findByEmail(email: string): Promise<UserRecord | null>;

  /**
   * @returns The single `root` account, or null before it is seeded.
   */
  findRoot(): Promise<UserRecord | null>;

  /**
   * @param data - Account to create.
   * @returns The created account.
   */
  create(data: NewUser): Promise<UserRecord>;

  /**
   * @param id - Identifier of the account.
   * @param changes - Fields to change.
   * @returns The updated account.
   */
  update(id: string, changes: UserChanges): Promise<UserRecord>;
}

/**
 * User repository backed by Prisma.
 */
export class PrismaUserRepository implements UserRepository {
  /**
   * @param client - Prisma client of the service.
   */
  constructor(private readonly client: PrismaClient) {}

  /**
   * @param email - Normalized email.
   * @returns The account with that email, or null.
   */
  findByEmail(email: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { email } });
  }

  /**
   * @returns The single `root` account, or null before it is seeded.
   */
  findRoot(): Promise<UserRecord | null> {
    return this.client.user.findFirst({ where: { role: "root" } });
  }

  /**
   * @param data - Account to create.
   * @returns The created account.
   */
  create(data: NewUser): Promise<UserRecord> {
    return this.client.user.create({ data });
  }

  /**
   * @param id - Identifier of the account.
   * @param changes - Fields to change.
   * @returns The updated account.
   */
  update(id: string, changes: UserChanges): Promise<UserRecord> {
    return this.client.user.update({ where: { id }, data: changes });
  }
}
