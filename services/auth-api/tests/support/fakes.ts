/**
 * @file In-memory replacements of the repositories and dependencies, used by unit tests.
 */

import { generateKeyPair } from "jose";

import type { AppContext } from "../../src/app";
import type { Settings } from "../../src/core/config";
import { ConflictError } from "../../src/core/errors";
import type { CaptchaVerifier } from "../../src/core/security/captcha";
import { JwtIssuer } from "../../src/core/security/jwt-issuer";
import { JwtVerifier } from "../../src/core/security/jwt-verifier";
import { PasswordHasher } from "../../src/core/security/password-hasher";
import type { Role } from "../../src/core/security/roles";
import type {
  NewRefreshToken,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from "../../src/repositories/refresh-token.repository";
import type { RolePermissionRepository } from "../../src/repositories/role-permission.repository";
import type {
  NewUser,
  UserChanges,
  UserListQuery,
  UserListResult,
  UserRecord,
  UserRepository,
} from "../../src/repositories/user.repository";
import type { Pingable } from "../../src/services/health.service";

/**
 * User repository that keeps accounts in a map.
 */
export class InMemoryUserRepository implements UserRepository {
  readonly users: Map<string, UserRecord> = new Map();

  /**
   * @param email - Email to check.
   * @param exceptId - Account allowed to hold it.
   * @throws ConflictError When another account already holds the email.
   */
  private assertEmailFree(email: string, exceptId?: string): void {
    if ([...this.users.values()].some((user) => user.email === email && user.id !== exceptId)) {
      throw new ConflictError("A user with this email already exists", { field: "email" });
    }
  }

  /**
   * @param id - Identifier of the account.
   * @returns The account, or null.
   */
  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

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
   * @param query - Filters and page.
   * @returns The page, newest accounts first, and the total matching the filters.
   */
  async list(query: UserListQuery): Promise<UserListResult> {
    const search: string = query.search?.toLowerCase() ?? "";
    const matching: UserRecord[] = [...this.users.values()]
      .filter((user) => query.role === undefined || user.role === query.role)
      .filter((user) => query.isActive === undefined || user.isActive === query.isActive)
      .filter((user) => !search || user.email.includes(search) || user.fullName.toLowerCase().includes(search))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: matching.slice(query.offset, query.offset + query.limit), total: matching.length };
  }

  /**
   * @param data - Account to create.
   * @returns The created account.
   */
  async create(data: NewUser): Promise<UserRecord> {
    this.assertEmailFree(data.email);
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
    if (changes.email !== undefined) {
      this.assertEmailFree(changes.email, id);
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

  /**
   * @param role - Role receiving the permission.
   * @param permission - Permission granted.
   */
  async grant(role: Role, permission: string): Promise<void> {
    const current: string[] = this.rows[role] ?? [];
    if (!current.includes(permission)) {
      this.rows[role] = [...current, permission];
    }
  }

  /**
   * @param role - Role losing the permission.
   * @param permission - Permission revoked.
   */
  async revoke(role: Role, permission: string): Promise<void> {
    this.rows[role] = (this.rows[role] ?? []).filter((stored) => stored !== permission);
  }
}

/**
 * Refresh token repository that keeps tokens in a map.
 */
export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens: Map<string, RefreshTokenRecord> = new Map();

  /**
   * @param data - Token to store.
   * @returns The stored token.
   */
  async create(data: NewRefreshToken): Promise<RefreshTokenRecord> {
    const token: RefreshTokenRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      revokedAt: null,
      replacedBy: null,
      ...data,
    };
    this.tokens.set(token.id, token);
    return token;
  }

  /**
   * @param tokenHash - SHA-256 hex digest of the token.
   * @returns The stored token, or null.
   */
  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return [...this.tokens.values()].find((token) => token.tokenHash === tokenHash) ?? null;
  }

  /**
   * @param currentId - Identifier of the token being used.
   * @param next - Successor in the same family.
   * @returns The successor, or null when the token had already been revoked.
   */
  async rotate(currentId: string, next: NewRefreshToken): Promise<RefreshTokenRecord | null> {
    const current: RefreshTokenRecord | undefined = this.tokens.get(currentId);
    if (current === undefined || current.revokedAt !== null) {
      return null;
    }
    const successor: RefreshTokenRecord = await this.create(next);
    this.tokens.set(currentId, { ...current, revokedAt: new Date(), replacedBy: successor.id });
    return successor;
  }

  /**
   * @param familyId - Family whose active tokens are revoked.
   */
  async revokeFamily(familyId: string): Promise<void> {
    this.revokeWhere((token) => token.familyId === familyId);
  }

  /**
   * @param userId - Account whose active tokens are revoked.
   */
  async revokeAllForUser(userId: string): Promise<void> {
    this.revokeWhere((token) => token.userId === userId);
  }

  /**
   * @param matches - Selects the tokens to revoke.
   */
  private revokeWhere(matches: (token: RefreshTokenRecord) => boolean): void {
    for (const token of this.tokens.values()) {
      if (matches(token) && token.revokedAt === null) {
        this.tokens.set(token.id, { ...token, revokedAt: new Date() });
      }
    }
  }

  /**
   * @param userId - Account to inspect.
   * @returns How many of its tokens are still active.
   */
  activeFor(userId: string): number {
    return [...this.tokens.values()].filter((token) => token.userId === userId && token.revokedAt === null).length;
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
 * Default permissions inserted by the initial migration.
 */
export const DEFAULT_ROLE_PERMISSIONS: Partial<Record<Role, string[]>> = {
  admin: [
    "clients:read",
    "clients:write",
    "engines:read",
    "engines:write",
    "repair_orders:read",
    "repair_orders:write",
    "users:manage",
    "permissions:manage",
  ],
  user: ["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"],
};

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
    trustProxy: 0,
    docsEnabled: true,
    maxPageSize: 100,
    turnstile: { secretKey: "", verifyUrl: "https://turnstile.test/siteverify" },
    rateLimit: { windowSeconds: 900, max: 1000, loginWindowSeconds: 900, loginMax: 1000 },
    database: { host: "localhost", port: 5432, name: "auth_db", user: "auth_service", password: "", poolSize: 1 },
    jwt: {
      privateKeyPath: "",
      privateKey: "",
      issuer: "motorix-auth-api",
      audience: "motorix-business-api",
      expiresInSeconds: 3600,
    },
    session: { refreshTokenTtlSeconds: 43200, secureCookie: true },
    root: { email: "root@motorix.local", password: "a-long-root-password", fullName: "Root" },
    log: { level: "CRITICAL", verbosity: 1, suppress: "", toFile: false, directory: "logs" },
    ...overrides,
  };
}

/**
 * Application context backed by in-memory repositories, a fresh key pair and a fast hasher.
 */
export interface TestContext extends AppContext {
  users: InMemoryUserRepository;
  rolePermissions: InMemoryRolePermissionRepository;
  database: FakeDatabase;
  captcha: FakeCaptchaVerifier;
  refreshTokens: InMemoryRefreshTokenRepository;
}

/**
 * Human verification stand-in that records its calls and fails when the test says so.
 */
export class FakeCaptchaVerifier implements CaptchaVerifier {
  readonly calls: { token: string | undefined; remoteIp: string | undefined }[] = [];

  /**
   * @param failure - Error thrown on every call, or null to accept.
   */
  constructor(public failure: Error | null = null) {}

  /**
   * @param token - Token sent by the client.
   * @param remoteIp - Address of the client.
   */
  async verify(token: string | undefined, remoteIp?: string): Promise<void> {
    this.calls.push({ token, remoteIp });
    if (this.failure !== null) {
      throw this.failure;
    }
  }
}

/**
 * Builds an application context for tests.
 *
 * @param overrides - Settings to replace.
 * @returns The context, with the default role permissions.
 */
export async function testContext(overrides: Partial<Settings> = {}): Promise<TestContext> {
  const settings: Settings = testSettings(overrides);
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  return {
    settings,
    database: new FakeDatabase(),
    jwtIssuer: new JwtIssuer(privateKey, settings.jwt),
    jwtVerifier: new JwtVerifier(publicKey, settings.jwt),
    captcha: new FakeCaptchaVerifier(),
    users: new InMemoryUserRepository(),
    rolePermissions: new InMemoryRolePermissionRepository(structuredClone(DEFAULT_ROLE_PERMISSIONS)),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    hasher: new PasswordHasher(1024, 1),
  };
}
