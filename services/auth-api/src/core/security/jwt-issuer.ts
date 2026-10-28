/**
 * @file Issuance of the RS256 access tokens that business-api verifies with the public key.
 */

import { importPKCS8, SignJWT, type CryptoKey } from "jose";

import type { Permission } from "./permissions";
import type { Role } from "./roles";

/**
 * Signing algorithm of every access token.
 */
export const ALGORITHM = "RS256";

/**
 * Identity and authorization data embedded in an access token.
 */
export interface TokenSubject {
  id: string;
  role: Role;
  permissions: readonly Permission[];
}

/**
 * Signed token handed to the client after a successful login.
 */
export interface AccessToken {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  expiresAt: Date;
}

/**
 * Options of the issuer.
 */
export interface JwtIssuerOptions {
  issuer: string;
  audience: string;
  expiresInSeconds: number;
}

/**
 * Signs access tokens with the private key; the only component able to create them.
 */
export class JwtIssuer {
  /**
   * @param key - RSA private key used to sign.
   * @param options - Issuer, audience and lifetime of the tokens.
   * @param now - Clock of the issuer, replaceable in tests.
   */
  constructor(
    private readonly key: CryptoKey,
    private readonly options: JwtIssuerOptions,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /**
   * Builds an issuer from a PEM encoded PKCS#8 private key.
   *
   * @param pem - Private key of auth-api.
   * @param options - Issuer, audience and lifetime of the tokens.
   * @returns The issuer.
   */
  static async fromPem(pem: string, options: JwtIssuerOptions): Promise<JwtIssuer> {
    return new JwtIssuer(await importPKCS8(pem, ALGORITHM), options);
  }

  /**
   * Signs a token with the claims `sub`, `role`, `permissions`, `iss`, `aud`, `iat` and `exp`.
   *
   * @param subject - Account the token is issued to.
   * @returns The signed token and its expiration.
   */
  async issue(subject: TokenSubject): Promise<AccessToken> {
    const issuedAt: number = Math.floor(this.now().getTime() / 1000);
    const expiresAt: number = issuedAt + this.options.expiresInSeconds;
    const accessToken: string = await new SignJWT({ role: subject.role, permissions: [...subject.permissions] })
      .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
      .setSubject(subject.id)
      .setIssuer(this.options.issuer)
      .setAudience(this.options.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .sign(this.key);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: this.options.expiresInSeconds,
      expiresAt: new Date(expiresAt * 1000),
    };
  }
}
