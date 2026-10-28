import { describe, expect, test } from "bun:test";
import { decodeProtectedHeader, exportPKCS8, generateKeyPair, jwtVerify, type JWTPayload } from "jose";

import { JwtIssuer, type AccessToken } from "../src/core/security/jwt-issuer";

const OPTIONS = { issuer: "motorix-auth-api", audience: "motorix-business-api", expiresInSeconds: 900 };

describe("JwtIssuer", () => {
  test("signs RS256 tokens with every claim business-api requires", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256", { extractable: true });
    const issuer: JwtIssuer = await JwtIssuer.fromPem(await exportPKCS8(privateKey), OPTIONS);
    const subject = { id: crypto.randomUUID(), role: "user" as const, permissions: ["clients:read" as const] };

    const token: AccessToken = await issuer.issue(subject);
    const { payload } = await jwtVerify(token.accessToken, publicKey, {
      issuer: OPTIONS.issuer,
      audience: OPTIONS.audience,
      algorithms: ["RS256"],
    });

    expect(decodeProtectedHeader(token.accessToken).alg).toBe("RS256");
    expect(payload.sub).toBe(subject.id);
    expect(payload.role).toBe("user");
    expect(payload.permissions).toEqual(["clients:read"]);
    expect((payload.exp ?? 0) - (payload.iat ?? 0)).toBe(900);
    expect(token.tokenType).toBe("Bearer");
    expect(token.expiresIn).toBe(900);
  });

  test("uses the injected clock for iat and exp", async () => {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const fixed: Date = new Date("2030-01-01T00:00:00Z");
    const issuer: JwtIssuer = new JwtIssuer(privateKey, OPTIONS, () => fixed);

    const token: AccessToken = await issuer.issue({ id: "id", role: "admin", permissions: [] });
    const { payload }: { payload: JWTPayload } = await jwtVerify(token.accessToken, publicKey, {
      currentDate: fixed,
    });

    expect(payload.iat).toBe(fixed.getTime() / 1000);
    expect(token.expiresAt.toISOString()).toBe("2030-01-01T00:15:00.000Z");
  });

  test("tokens fail verification with another key", async () => {
    const { privateKey } = await generateKeyPair("RS256");
    const { publicKey: otherPublicKey } = await generateKeyPair("RS256");
    const issuer: JwtIssuer = new JwtIssuer(privateKey, OPTIONS);

    const token: AccessToken = await issuer.issue({ id: "id", role: "user", permissions: [] });

    await expect(jwtVerify(token.accessToken, otherPublicKey)).rejects.toThrow();
  });
});
