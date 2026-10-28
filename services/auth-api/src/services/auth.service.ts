/**
 * @file Sessions: login with email and password, refresh token rotation and logout.
 */

import { AuthenticationError } from "../core/errors";
import { log } from "../core/logging";
import type { CaptchaVerifier } from "../core/security/captcha";
import type { AccessToken, JwtIssuer } from "../core/security/jwt-issuer";
import type { PasswordHasher } from "../core/security/password-hasher";
import type { Permission } from "../core/security/permissions";
import { generateRefreshToken, hashRefreshToken } from "../core/security/refresh-token";
import type { RefreshTokenRecord, RefreshTokenRepository } from "../repositories/refresh-token.repository";
import type { UserRecord, UserRepository } from "../repositories/user.repository";
import type { LoginInput } from "../schemas/auth.schemas";
import type { PermissionService } from "./permission.service";

/**
 * Message of every failed login, so a response never tells whether the email exists.
 */
const INVALID_CREDENTIALS: string = "Invalid email or password";

/**
 * Message of every refused refresh, whatever the reason.
 */
const INVALID_SESSION: string = "The session has ended, log in again";

/**
 * Refresh token handed to the browser, with the moment its session ends.
 */
export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

/**
 * Outcome of a successful login or refresh.
 */
export interface SessionResult {
  user: UserRecord;
  permissions: Permission[];
  token: AccessToken;
  refreshToken: IssuedRefreshToken;
}

/**
 * Dependencies and settings of the session service.
 */
export interface AuthServiceOptions {
  users: UserRepository;
  hasher: PasswordHasher;
  permissions: PermissionService;
  issuer: JwtIssuer;
  captcha: CaptchaVerifier;
  refreshTokens: RefreshTokenRepository;
  refreshTokenTtlSeconds: number;
  now?: () => Date;
}

/**
 * Checks credentials, issues access tokens and keeps sessions alive through rotating refresh tokens.
 */
export class AuthService {
  private dummyHash: Promise<string> | null = null;
  private readonly now: () => Date;

  /**
   * @param options - Repositories, security helpers and the absolute session lifetime.
   */
  constructor(private readonly options: AuthServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Hash checked when the email does not exist, so both failures take the same time.
   *
   * @returns A hash of a throwaway password, computed once.
   */
  private fallbackHash(): Promise<string> {
    this.dummyHash ??= this.options.hasher.hash(crypto.randomUUID());
    return this.dummyHash;
  }

  /**
   * Verifies the human challenge and the credentials, then opens a session.
   *
   * The challenge goes first, so a bot never gets to spend a password hash.
   *
   * @param credentials - Email, password and Turnstile token.
   * @param remoteIp - Address of the client.
   * @returns The account, its permissions, the access token and the refresh token of the new session.
   * @throws CaptchaError When the challenge is missing or rejected.
   * @throws AuthenticationError With the same message for an unknown email, a wrong password or an
   *   inactive account.
   */
  async login(credentials: LoginInput, remoteIp?: string): Promise<SessionResult> {
    await this.options.captcha.verify(credentials.turnstile_token, remoteIp);
    const user: UserRecord | null = await this.options.users.findByEmail(credentials.email);
    const hash: string = user?.passwordHash ?? (await this.fallbackHash());
    const valid: boolean = await this.options.hasher.verify(credentials.password, hash);
    if (user === null || !valid || !user.isActive) {
      log("WARNING", `Failed login for ${credentials.email}`);
      throw new AuthenticationError(INVALID_CREDENTIALS);
    }
    const expiresAt: Date = new Date(this.now().getTime() + this.options.refreshTokenTtlSeconds * 1000);
    const token: string = generateRefreshToken();
    await this.options.refreshTokens.create({
      userId: user.id,
      familyId: crypto.randomUUID(),
      tokenHash: hashRefreshToken(token),
      expiresAt,
    });
    log("INFO", `Login of ${user.email} (${user.role})`, 2);
    return this.openSession(user, { token, expiresAt });
  }

  /**
   * Exchanges a refresh token for a new access token and a new refresh token.
   *
   * The used token is revoked and replaced in the same family; the session keeps its original end.
   * Presenting a token that was already rotated means it was copied, so the whole family is revoked
   * and both the thief and the owner must log in again.
   *
   * @param presented - Refresh token sent in the cookie.
   * @returns The account, its current permissions and the new tokens.
   * @throws AuthenticationError When the token is missing, unknown, reused, expired, or its account is inactive.
   */
  async refresh(presented: string | undefined): Promise<SessionResult> {
    if (!presented) {
      throw new AuthenticationError(INVALID_SESSION);
    }
    const stored: RefreshTokenRecord | null = await this.options.refreshTokens.findByHash(hashRefreshToken(presented));
    if (stored === null) {
      throw new AuthenticationError(INVALID_SESSION);
    }
    if (stored.revokedAt !== null) {
      await this.options.refreshTokens.revokeFamily(stored.familyId);
      log("WARNING", `Reused refresh token for user ${stored.userId}; session ${stored.familyId} revoked`);
      throw new AuthenticationError(INVALID_SESSION);
    }
    if (stored.expiresAt.getTime() <= this.now().getTime()) {
      throw new AuthenticationError(INVALID_SESSION);
    }
    const user: UserRecord | null = await this.options.users.findById(stored.userId);
    if (user === null || !user.isActive) {
      await this.options.refreshTokens.revokeFamily(stored.familyId);
      throw new AuthenticationError(INVALID_SESSION);
    }
    const token: string = generateRefreshToken();
    const successor: RefreshTokenRecord | null = await this.options.refreshTokens.rotate(stored.id, {
      userId: user.id,
      familyId: stored.familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: stored.expiresAt,
    });
    if (successor === null) {
      await this.options.refreshTokens.revokeFamily(stored.familyId);
      log("WARNING", `Concurrent reuse of a refresh token for user ${user.id}; session ${stored.familyId} revoked`);
      throw new AuthenticationError(INVALID_SESSION);
    }
    return this.openSession(user, { token, expiresAt: stored.expiresAt });
  }

  /**
   * Ends the session of a refresh token; an unknown or missing token changes nothing.
   *
   * @param presented - Refresh token sent in the cookie.
   */
  async logout(presented: string | undefined): Promise<void> {
    if (!presented) {
      return;
    }
    const stored: RefreshTokenRecord | null = await this.options.refreshTokens.findByHash(hashRefreshToken(presented));
    if (stored !== null) {
      await this.options.refreshTokens.revokeFamily(stored.familyId);
      log("INFO", `Logout of user ${stored.userId}`, 2);
    }
  }

  /**
   * Signs an access token with the current role and permissions of the account.
   *
   * @param user - Account of the session.
   * @param refreshToken - Refresh token of the session.
   * @returns The session result.
   */
  private async openSession(user: UserRecord, refreshToken: IssuedRefreshToken): Promise<SessionResult> {
    const permissions: Permission[] = await this.options.permissions.resolve(user.role);
    const token: AccessToken = await this.options.issuer.issue({ id: user.id, role: user.role, permissions });
    return { user, permissions, token, refreshToken };
  }
}
