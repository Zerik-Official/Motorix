import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import { REFRESH_COOKIE_NAME } from "../src/core/security/refresh-token";
import type { UserRecord } from "../src/repositories/user.repository";
import { testContext, type TestContext } from "./support/fakes";

const PASSWORD = "a-good-password";

let context: TestContext;
let app: Express;
let operator: UserRecord;

/**
 * Reads the refresh cookie set by a response.
 *
 * @param response - Response of login or refresh.
 * @returns The whole `Set-Cookie` line of the refresh cookie, or undefined.
 */
function refreshCookieLine(response: Response): string | undefined {
  const lines: string[] = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
  return lines.find((line) => line.startsWith(`${REFRESH_COOKIE_NAME}=`));
}

/**
 * Extracts the `name=value` pair of the refresh cookie, ready to send back.
 *
 * @param response - Response of login or refresh.
 * @returns The cookie pair.
 */
function refreshCookie(response: Response): string {
  const line: string | undefined = refreshCookieLine(response);
  if (line === undefined) {
    throw new Error("The response did not set the refresh cookie");
  }
  return line.split(";")[0] as string;
}

/**
 * Logs the operator in.
 *
 * @returns The login response.
 */
function login(): Promise<Response> {
  return request(app).post("/api/v1/auth/login").send({ email: operator.email, password: PASSWORD });
}

/**
 * Sends a refresh request with a cookie.
 *
 * @param cookie - Cookie pair to send, if any.
 * @returns The refresh response.
 */
function refresh(cookie?: string): Promise<Response> {
  const pending = request(app).post("/api/v1/auth/refresh");
  return cookie ? pending.set("Cookie", cookie) : pending;
}

beforeAll(() => configureLogging("CRITICAL", 1, ""));

beforeEach(async () => {
  context = await testContext();
  app = createApp(context);
  operator = await context.users.create({
    email: "operator@motorix.test",
    fullName: "Operator",
    passwordHash: await context.hasher.hash(PASSWORD),
    role: "user",
  });
});

describe("refresh cookie", () => {
  test("login sets an httpOnly, secure, same-site cookie limited to the session endpoints", async () => {
    const response: Response = await login();
    const line: string = refreshCookieLine(response) ?? "";
    expect(line).toContain("HttpOnly");
    expect(line).toContain("Secure");
    expect(line).toContain("SameSite=Strict");
    expect(line).toContain("Path=/api/v1/auth");
    expect(line).toContain("Expires=");
    expect(JSON.stringify(response.body)).not.toContain(refreshCookie(response).split("=")[1] as string);
    expect(response.body.session_expires_at).toBeDefined();
  });

  test("only the hash of the token is stored", async () => {
    const response: Response = await login();
    const raw: string = refreshCookie(response).split("=")[1] as string;
    const stored = [...context.refreshTokens.tokens.values()];
    expect(stored).toHaveLength(1);
    expect(stored[0]?.tokenHash).toHaveLength(64);
    expect(stored[0]?.tokenHash).not.toBe(raw);
  });
});

describe("POST /api/v1/auth/refresh", () => {
  test("returns a new access token and rotates the refresh token, keeping the session end", async () => {
    const first: Response = await login();
    const renewed: Response = await refresh(refreshCookie(first));

    expect(renewed.status).toBe(200);
    expect(await context.jwtVerifier.verify(renewed.body.access_token)).toBe(operator.id);
    expect(refreshCookie(renewed)).not.toBe(refreshCookie(first));
    expect(renewed.body.session_expires_at).toBe(first.body.session_expires_at);
    expect(context.refreshTokens.activeFor(operator.id)).toBe(1);
  });

  test("carries the permissions the role holds now", async () => {
    const first: Response = await login();
    context.rolePermissions.rows.user = ["clients:read"];
    const renewed: Response = await refresh(refreshCookie(first));
    expect(renewed.body.user.permissions).toEqual(["clients:read"]);
  });

  test("reusing a rotated token ends the whole session", async () => {
    const first: Response = await login();
    const stolen: string = refreshCookie(first);
    const renewed: Response = await refresh(stolen);

    const replay: Response = await refresh(stolen);
    const owner: Response = await refresh(refreshCookie(renewed));

    expect(replay.status).toBe(401);
    expect(owner.status).toBe(401);
    expect(context.refreshTokens.activeFor(operator.id)).toBe(0);
  });

  test("refuses a missing, unknown or expired token and clears the cookie", async () => {
    const missing: Response = await refresh();
    const unknown: Response = await refresh(`${REFRESH_COOKIE_NAME}=not-a-real-token`);
    const first: Response = await login();
    for (const token of context.refreshTokens.tokens.values()) {
      context.refreshTokens.tokens.set(token.id, { ...token, expiresAt: new Date(Date.now() - 1000) });
    }
    const expired: Response = await refresh(refreshCookie(first));

    for (const response of [missing, unknown, expired]) {
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe("The session has ended, log in again");
      expect(refreshCookieLine(response)).toContain("Expires=Thu, 01 Jan 1970");
    }
  });

  test("refuses the session of a deactivated account", async () => {
    const first: Response = await login();
    await context.users.update(operator.id, { isActive: false });
    expect((await refresh(refreshCookie(first))).status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  test("ends the session and clears the cookie", async () => {
    const first: Response = await login();
    const cookie: string = refreshCookie(first);
    const logout: Response = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);

    expect(logout.status).toBe(204);
    expect(refreshCookieLine(logout)).toContain("Expires=Thu, 01 Jan 1970");
    expect((await refresh(cookie)).status).toBe(401);
  });

  test("answers 204 without a session", async () => {
    expect((await request(app).post("/api/v1/auth/logout")).status).toBe(204);
  });
});

describe("account changes end the sessions", () => {
  /**
   * Signs a token for an admin who manages the operator.
   *
   * @returns The bearer header value.
   */
  async function adminBearer(): Promise<string> {
    const admin: UserRecord = await context.users.create({
      email: "admin@motorix.test",
      fullName: "Admin",
      passwordHash: "unused",
      role: "admin",
    });
    const { accessToken } = await context.jwtIssuer.issue({ id: admin.id, role: "admin", permissions: [] });
    return `Bearer ${accessToken}`;
  }

  test("deactivating an account revokes its sessions", async () => {
    await login();
    await login();
    await request(app).delete(`/api/v1/users/${operator.id}`).set("Authorization", await adminBearer());
    expect(context.refreshTokens.activeFor(operator.id)).toBe(0);
  });

  test("resetting a password revokes the sessions; a plain edit does not", async () => {
    await login();
    const bearer: string = await adminBearer();
    const edit = { email: operator.email, full_name: "Renamed", role: "user", is_active: true };
    await request(app).put(`/api/v1/users/${operator.id}`).set("Authorization", bearer).send(edit);
    expect(context.refreshTokens.activeFor(operator.id)).toBe(1);

    await request(app)
      .put(`/api/v1/users/${operator.id}`)
      .set("Authorization", bearer)
      .send({ ...edit, password: "a-brand-new-password" });
    expect(context.refreshTokens.activeFor(operator.id)).toBe(0);
  });

  test("changing the own password revokes every session of the account", async () => {
    const session: Response = await login();
    await login();
    const response: Response = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", `Bearer ${session.body.access_token}`)
      .send({ current_password: PASSWORD, new_password: "a-brand-new-password" });
    expect(response.status).toBe(204);
    expect(context.refreshTokens.activeFor(operator.id)).toBe(0);
  });
});
