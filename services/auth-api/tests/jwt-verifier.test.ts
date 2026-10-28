import { describe, expect, test } from "bun:test";
import { exportPKCS8, generateKeyPair } from "jose";

import { AuthenticationError } from "../src/core/errors";
import { JwtIssuer, type AccessToken } from "../src/core/security/jwt-issuer";
import { JwtVerifier } from "../src/core/security/jwt-verifier";

const OPTIONS = { issuer: "motorix-auth-api", audience: "motorix-business-api", expiresInSeconds: 60 };

describe("JwtVerifier", () => {
  test("derives the public key from the private key and accepts its own tokens", async () => {
    const { privateKey } = await generateKeyPair("RS256", { extractable: true });
    const pem: string = await exportPKCS8(privateKey);
    const issuer: JwtIssuer = await JwtIssuer.fromPem(pem, OPTIONS);
    const verifier: JwtVerifier = await JwtVerifier.fromPrivatePem(pem, OPTIONS);

    const token: AccessToken = await issuer.issue({ id: "user-id", role: "user", permissions: [] });

    expect(await verifier.verify(token.accessToken)).toBe("user-id");
  });

  test("rejects expired tokens with a specific message", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const past: Date = new Date(Date.now() - 3_600_000);
    const issuer: JwtIssuer = new JwtIssuer(privateKey, OPTIONS, () => past);
    const verifier: JwtVerifier = new JwtVerifier(publicKey, OPTIONS);

    const token: AccessToken = await issuer.issue({ id: "user-id", role: "user", permissions: [] });

    await expect(verifier.verify(token.accessToken)).rejects.toThrow("The access token has expired");
  });

  test("rejects another audience, another key and garbage", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const { privateKey: otherKey } = await generateKeyPair("RS256");
    const verifier: JwtVerifier = new JwtVerifier(publicKey, OPTIONS);
    const wrongAudience: AccessToken = await new JwtIssuer(privateKey, { ...OPTIONS, audience: "other" }).issue({
      id: "user-id",
      role: "user",
      permissions: [],
    });
    const wrongKey: AccessToken = await new JwtIssuer(otherKey, OPTIONS).issue({
      id: "user-id",
      role: "user",
      permissions: [],
    });

    await expect(verifier.verify(wrongAudience.accessToken)).rejects.toThrow(AuthenticationError);
    await expect(verifier.verify(wrongKey.accessToken)).rejects.toThrow(AuthenticationError);
    await expect(verifier.verify("not.a.token")).rejects.toThrow(AuthenticationError);
  });
});
