/**
 * @file Login with email and password, which issues the access token.
 */

import { AuthenticationError } from "../core/errors";
import { log } from "../core/logging";
import type { CaptchaVerifier } from "../core/security/captcha";
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
   * @param captcha - Human verification checked before the credentials.
   */
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly permissions: PermissionService,
    private readonly issuer: JwtIssuer,
    private readonly captcha: CaptchaVerifier,
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
   * Verifies the human challenge and the credentials, then signs a token with the current role and
   * permissions of the account. The challenge goes first, so a bot never gets to spend a password hash.
   *
   * @param credentials - Email, password and Turnstile token.
   * @param remoteIp - Address of the client.
   * @returns The account, its permissions and the signed token.
   * @throws CaptchaError When the challenge is missing or rejected.
   * @throws AuthenticationError With the same message for an unknown email, a wrong password or an
   *   inactive account.
   */
  async login(credentials: LoginInput, remoteIp?: string): Promise<LoginResult> {
    await this.captcha.verify(credentials.turnstile_token, remoteIp);
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
