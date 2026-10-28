/**
 * @file Data access for the `users` table.
 */

import { ConflictError } from "../core/errors";
import type { Role } from "../core/security/roles";
import type { Prisma, PrismaClient } from "../generated/prisma/client";

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
 * Filters and page of an account listing.
 */
export interface UserListQuery {
  offset: number;
  limit: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

/**
 * One page of accounts and the number of accounts matching the filters.
 */
export interface UserListResult {
  items: UserRecord[];
  total: number;
}

/**
 * Reads and writes accounts.
 */
export interface UserRepository {
  /**
   * @param id - Identifier of the account.
   * @returns The account, or null.
   */
  findById(id: string): Promise<UserRecord | null>;

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
   * @param query - Filters and page.
   * @returns The page, newest accounts first, and the total matching the filters.
   */
  list(query: UserListQuery): Promise<UserListResult>;

  /**
   * @param data - Account to create.
   * @returns The created account.
   * @throws ConflictError When the email is already used.
   */
  create(data: NewUser): Promise<UserRecord>;

  /**
   * @param id - Identifier of the account.
   * @param changes - Fields to change.
   * @returns The updated account.
   * @throws ConflictError When the new email is already used.
   */
  update(id: string, changes: UserChanges): Promise<UserRecord>;
}

/**
 * Tells whether Prisma rejected a write because of a unique constraint.
 *
 * @param error - Error raised by Prisma.
 * @returns True for a unique constraint violation.
 */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
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
   * @param id - Identifier of the account.
   * @returns The account, or null.
   */
  findById(id: string): Promise<UserRecord | null> {
    return this.client.user.findUnique({ where: { id } });
  }

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
   * @param query - Filters and page.
   * @returns The page, newest accounts first, and the total matching the filters.
   */
  async list(query: UserListQuery): Promise<UserListResult> {
    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.isActive,
      OR: query.search
        ? [
            { email: { contains: query.search, mode: "insensitive" } },
            { fullName: { contains: query.search, mode: "insensitive" } },
          ]
        : undefined,
    };
    const [items, total] = await this.client.$transaction([
      this.client.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: query.offset,
        take: query.limit,
      }),
      this.client.user.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * @param data - Account to create.
   * @returns The created account.
   * @throws ConflictError When the email is already used.
   */
  async create(data: NewUser): Promise<UserRecord> {
    try {
      return await this.client.user.create({ data });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A user with this email already exists", { field: "email" });
      }
      throw error;
    }
  }

  /**
   * @param id - Identifier of the account.
   * @param changes - Fields to change.
   * @returns The updated account.
   * @throws ConflictError When the new email is already used.
   */
  async update(id: string, changes: UserChanges): Promise<UserRecord> {
    try {
      return await this.client.user.update({ where: { id }, data: changes });
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("A user with this email already exists", { field: "email" });
      }
      throw error;
    }
  }
}
