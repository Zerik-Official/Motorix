/**
 * @file In-memory replacements of the repositories and dependencies, used by unit tests.
 */

import type { Settings } from "../../src/core/config";
import type { Role } from "../../src/core/security/roles";
import type { RolePermissionRepository } from "../../src/repositories/role-permission.repository";
import type { NewUser, UserChanges, UserRecord, UserRepository } from "../../src/repositories/user.repository";
import type { Pingable } from "../../src/services/health.service";

/**
 * User repository that keeps accounts in a map.
 */
export class InMemoryUserRepository implements UserRepository {
  readonly users: Map<string, UserRecord> = new Map();

  /**
   * @param email - Normalized email.
   * @returns The account with that email, or null.
   */
  async findByEmail(email: string): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }

  /**
   * @returns The `root` account, or null.
   */
  async findRoot(): Promise<UserRecord | null> {
    return [...this.users.values()].find((user) => user.role === "root") ?? null;
  }

  /**
   * @param data - Account to create.
   * @returns The created account.
   */
  async create(data: NewUser): Promise<UserRecord> {
    const now: Date = new Date();
    const user: UserRecord = { id: crypto.randomUUID(), isActive: true, createdAt: now, updatedAt: now, ...data };
    this.users.set(user.id, user);
    return user;
  }

  /**
   * @param id - Identifier of the account.
   * @param changes - Fields to change.
   * @returns The updated account.
   */
  async update(id: string, changes: UserChanges): Promise<UserRecord> {
    const current: UserRecord | undefined = this.users.get(id);
    if (current === undefined) {
      throw new Error(`Unknown user ${id}`);
    }
    const updated: UserRecord = { ...current, ...changes, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }
}

/**
 * Role permission repository that reads from a fixed map.
 */
export class InMemoryRolePermissionRepository implements RolePermissionRepository {
  /**
   * @param rows - Stored permission names of each role.
   */
  constructor(readonly rows: Partial<Record<Role, string[]>> = {}) {}

  /**
   * @param role - Role to look up.
   * @returns The stored permission names of the role.
   */
  async listByRole(role: Role): Promise<string[]> {
    return [...(this.rows[role] ?? [])];
  }
}

/**
 * Database stand-in whose availability is set by the test.
 */
export class FakeDatabase implements Pingable {
  /**
   * @param available - Whether `ping` succeeds.
   */
  constructor(public available: boolean = true) {}

  /**
   * @returns The configured availability.
   */
  async ping(): Promise<boolean> {
    return this.available;
  }
}

/**
 * Minimal valid environment of the service.
 */
export const BASE_ENV: Record<string, string> = {
  ROOT_EMAIL: "Root@Motorix.Local",
  ROOT_PASSWORD: "a-long-root-password",
  JWT_PRIVATE_KEY: "inline",
  LOG_TO_FILE: "false",
};

/**
 * Builds settings for tests, without reading the process environment.
 *
 * @param overrides - Settings to replace.
 * @returns The settings.
 */
export function testSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    appName: "auth-api",
    environment: "test",
    host: "127.0.0.1",
    port: 3000,
    corsOrigins: [],
    database: { host: "localhost", port: 5432, name: "auth_db", user: "auth_service", password: "", poolSize: 1 },
    jwt: {
      privateKeyPath: "",
      privateKey: "",
      issuer: "motorix-auth-api",
      audience: "motorix-business-api",
      expiresInSeconds: 3600,
    },
    root: { email: "root@motorix.local", password: "a-long-root-password", fullName: "Root" },
    log: { level: "CRITICAL", verbosity: 1, suppress: "", toFile: false, directory: "logs" },
    ...overrides,
  };
}
