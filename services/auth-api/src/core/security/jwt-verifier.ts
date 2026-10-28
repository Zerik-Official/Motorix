/**
 * @file Verification of the access tokens issued by this service, with the public key.
 */

import { createPublicKey } from "node:crypto";

import { errors, importSPKI, jwtVerify, type CryptoKey, type JWTPayload } from "jose";

import { AuthenticationError } from "../errors";
import { ALGORITHM } from "./jwt-issuer";

/**
 * Claims every token must carry.
 */
const REQUIRED_CLAIMS: string[] = ["sub", "role", "iss", "aud", "iat", "exp"];

/**
 * Options of the verifier.
 */
export interface JwtVerifierOptions {
  issuer: string;
  audience: string;
  leewaySeconds?: number;
}

/**
 * Checks signature, expiration, issuer and audience of access tokens.
 */
export class JwtVerifier {
  /**
   * @param key - RSA public key matching the signing key.
   * @param options - Expected issuer and audience, and the tolerated clock skew.
   */
  constructor(
    private readonly key: CryptoKey,
    private readonly options: JwtVerifierOptions,
  ) {}

  /**
   * Builds a verifier from the PEM private key, deriving its public key.
   *
   * @param privatePem - Private key of auth-api.
   * @param options - Expected issuer and audience.
   * @returns The verifier.
   */
  static async fromPrivatePem(privatePem: string, options: JwtVerifierOptions): Promise<JwtVerifier> {
    const publicPem: string = createPublicKey(privatePem).export({ type: "spki", format: "pem" }).toString();
    return new JwtVerifier(await importSPKI(publicPem, ALGORITHM), options);
  }

  /**
   * Verifies a token and returns the identifier of its account.
   *
   * @param token - Encoded JWT received in the `Authorization` header.
   * @returns The `sub` claim.
   * @throws AuthenticationError When the token is expired, forged, issued for another audience or incomplete.
   */
  async verify(token: string): Promise<string> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.key, {
        algorithms: [ALGORITHM],
        issuer: this.options.issuer,
        audience: this.options.audience,
        clockTolerance: this.options.leewaySeconds ?? 0,
        requiredClaims: REQUIRED_CLAIMS,
      }));
    } catch (error: unknown) {
      if (error instanceof errors.JWTExpired) {
        throw new AuthenticationError("The access token has expired");
      }
      throw new AuthenticationError("The access token is not valid");
    }
    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      throw new AuthenticationError("The access token carries invalid claims");
    }
    return payload.sub;
  }
}
