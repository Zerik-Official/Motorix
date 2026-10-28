/**
 * @file Login with email and password, which issues the access token.
 */

import { AuthenticationError } from "../core/errors";
import { log } from "../core/logging";
import type { AccessToken, JwtIssuer } from "../core/security/jwt-issuer";
import type { PasswordHasher } from "../core/security/password-hasher";
import type { Permission } from "../core/security/permissions";
import type { UserRecord, UserRepository } from "../repositories/user.repository";
import type { LoginInput } from "../schemas/auth.schemas";
import type { PermissionService } from "./permission.service";

/**
 * Message of every failed login, so a response never tells whether the email exists.
 */
const INVALID_CREDENTIALS: string = "Invalid email or password";

/**
 * Outcome of a successful login.
 */
export interface LoginResult {
  user: UserRecord;
  permissions: Permission[];
  token: AccessToken;
}

/**
 * Checks credentials and issues access tokens.
 */
export class AuthService {
  private dummyHash: Promise<string> | null = null;

  /**
   * @param users - Account storage.
   * @param hasher - Password hasher.
   * @param permissions - Permission resolution per role.
   * @param issuer - Access token issuer.
   */
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly permissions: PermissionService,
    private readonly issuer: JwtIssuer,
  ) {}

  /**
   * Hash checked when the email does not exist, so both failures take the same time.
   *
   * @returns A hash of a throwaway password, computed once.
   */
  private fallbackHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash(crypto.randomUUID());
    return this.dummyHash;
  }

  /**
   * Verifies the credentials and signs a token with the current role and permissions of the account.
   *
   * @param credentials - Email and password.
   * @returns The account, its permissions and the signed token.
   * @throws AuthenticationError With the same message for an unknown email, a wrong password or an
   *   inactive account.
   */
  async login(credentials: LoginInput): Promise<LoginResult> {
    const user: UserRecord | null = await this.users.findByEmail(credentials.email);
    const hash: string = user?.passwordHash ?? (await this.fallbackHash());
    const valid: boolean = await this.hasher.verify(credentials.password, hash);
    if (user === null || !valid || !user.isActive) {
      log("WARNING", `Failed login for ${credentials.email}`);
      throw new AuthenticationError(INVALID_CREDENTIALS);
    }
    const permissions: Permission[] = await this.permissions.resolve(user.role);
    const token: AccessToken = await this.issuer.issue({ id: user.id, role: user.role, permissions });
    log("INFO", `Login of ${user.email} (${user.role})`, 2);
    return { user, permissions, token };
  }
}
