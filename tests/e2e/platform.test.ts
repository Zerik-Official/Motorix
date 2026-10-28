/**
 * @file End-to-end flow of the platform: login in auth-api, token verification and permissions in business-api.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { AUTH_URL, BUSINESS_URL, ROOT, RUN_ID, call, decodeClaims, forgeToken, login, type ApiResponse } from "./support/api";

const PASSWORD = "e2e-password-0000";

let rootToken: string;
let adminToken: string;
let operatorToken: string;
let operatorId: string;
let clientId: string;
let engineId: string;
let orderId: string;

/**
 * Registers an account through auth-api with the root token.
 *
 * @param role - Role of the account.
 * @returns The identifier of the account and its email.
 */
async function register(role: "admin" | "user"): Promise<{ id: string; email: string }> {
  const email: string = `e2e.${role}.${RUN_ID}@motorix.ci`;
  const response: ApiResponse = await call("POST", `${AUTH_URL}/api/v1/users`, rootToken, {
    email,
    full_name: `E2E ${role}`,
    password: PASSWORD,
    role,
  });
  expect(response.status).toBe(201);
  return { id: response.body.id, email };
}

beforeAll(async () => {
  rootToken = await login(ROOT.email, ROOT.password);
  const admin = await register("admin");
  const operator = await register("user");
  operatorId = operator.id;
  adminToken = await login(admin.email, PASSWORD);
  operatorToken = await login(operator.email, PASSWORD);
});

afterAll(async () => {
  await call("PUT", `${AUTH_URL}/api/v1/roles/user/permissions/repair_orders:write`, rootToken);
});

describe("services", () => {
  test("both services and their databases are healthy", async () => {
    expect((await call("GET", `${AUTH_URL}/health`)).body).toEqual({ status: "ok", database: "ok" });
    expect((await call("GET", `${BUSINESS_URL}/health`)).body).toEqual({ status: "ok", database: "ok" });
  });
});

describe("token issued by auth-api, verified by business-api", () => {
  test("business-api accepts it and reads the identity and permissions it carries", async () => {
    const me: ApiResponse = await call("GET", `${BUSINESS_URL}/api/v1/me`, operatorToken);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(operatorId);
    expect(me.body.role).toBe("user");
    expect(me.body.permissions.sort()).toEqual(["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"]);
  });

  test("a copy of a real token signed with another key is rejected", async () => {
    const forged: string = await forgeToken({ ...decodeClaims(operatorToken), role: "root" });
    const response: ApiResponse = await call("GET", `${BUSINESS_URL}/api/v1/me`, forged);
    expect(response.status).toBe(401);
  });

  test("a token with a tampered payload is rejected", async () => {
    const [header, , signature] = operatorToken.split(".");
    const payload: string = Buffer.from(JSON.stringify({ ...decodeClaims(operatorToken), role: "root" })).toString("base64url");
    const response: ApiResponse = await call("GET", `${BUSINESS_URL}/api/v1/me`, `${header}.${payload}.${signature}`);
    expect(response.status).toBe(401);
  });

  test("requests without a token are rejected", async () => {
    expect((await call("GET", `${BUSINESS_URL}/api/v1/clients`)).status).toBe(401);
  });
});

describe("repair order lifecycle under role permissions", () => {
  test("admin registers the client and the engine", async () => {
    const client: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/clients`, adminToken, {
      name: `E2E Minera ${RUN_ID}`,
      identification_type: "nit",
      identification_number: `E2E-${RUN_ID}`,
      email: "e2e@minera-andina.com",
    });
    expect(client.status).toBe(201);
    clientId = client.body.id;

    const engine: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/engines`, adminToken, {
      serial_number: `E2E-ENG-${RUN_ID}`,
      manufacturer: "Caterpillar",
      model: "C175-16",
      engine_type: "Diesel",
      power_rating: "2800 kW",
      client_id: clientId,
    });
    expect(engine.status).toBe(201);
    engineId = engine.body.id;
  });

  test("the operator can read clients but cannot register them", async () => {
    expect((await call("GET", `${BUSINESS_URL}/api/v1/clients/${clientId}`, operatorToken)).status).toBe(200);
    const denied: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/clients`, operatorToken, {
      name: "Denied",
      identification_type: "nit",
      identification_number: `E2E-DENIED-${RUN_ID}`,
      email: "denied@minera-andina.com",
    });
    expect(denied.status).toBe(403);
    expect(denied.body.error.details).toEqual({ permission: "clients:write" });
  });

  test("the operator opens a repair order, whose client comes from the engine", async () => {
    const order: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/repair-orders`, operatorToken, {
      engine_id: engineId,
      reported_issue: "Loss of power under load",
      technician_name: "E2E technician",
    });
    expect(order.status).toBe(201);
    expect(order.body.client.id).toBe(clientId);
    expect(order.body.status).toBe("received");
    expect(order.body.created_by).toBe(operatorId);
    orderId = order.body.id;
  });

  test("the operator moves the order through its states and the history records who did it", async () => {
    for (const status of ["in_diagnosis", "in_repair", "delivered"]) {
      const response: ApiResponse = await call("PATCH", `${BUSINESS_URL}/api/v1/repair-orders/${orderId}/status`, operatorToken, {
        status,
      });
      expect(response.status).toBe(200);
    }
    const detail: ApiResponse = await call("GET", `${BUSINESS_URL}/api/v1/repair-orders/${orderId}`, operatorToken);
    expect(detail.body.status).toBe("delivered");
    expect(detail.body.delivered_at).not.toBeNull();
    expect(detail.body.history.map((entry: { to_status: string }) => entry.to_status)).toEqual([
      "received",
      "in_diagnosis",
      "in_repair",
      "delivered",
    ]);
    expect(detail.body.history.every((entry: { changed_by: string }) => entry.changed_by === operatorId)).toBe(true);
  });
});

describe("session renewal with the refresh cookie", () => {
  /**
   * Sends a session request with an optional cookie and returns the cookie it sets.
   *
   * @param path - `login`, `refresh` or `logout`.
   * @param cookie - `name=value` pair to send, if any.
   * @param body - JSON body, for the login.
   * @returns The status, the body and the refresh cookie pair set by the response, if any.
   */
  async function session(
    path: "login" | "refresh" | "logout",
    cookie?: string,
    body?: unknown,
  ): Promise<{ status: number; body: any; cookie: string | undefined }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cookie) {
      headers.Cookie = cookie;
    }
    const response: Response = await fetch(`${AUTH_URL}/api/v1/auth/${path}`, {
      method: "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set: string | undefined = response.headers
      .getSetCookie()
      .find((line) => line.startsWith("motorix_refresh=") && !line.startsWith("motorix_refresh=;"));
    const text: string = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null, cookie: set?.split(";")[0] };
  }

  test("a renewed access token works in business-api, and logout ends the session", async () => {
    const opened = await session("login", undefined, { email: ROOT.email, password: ROOT.password });
    expect(opened.status).toBe(200);
    expect(opened.cookie).toBeDefined();

    const renewed = await session("refresh", opened.cookie);
    expect(renewed.status).toBe(200);
    expect(renewed.cookie).not.toBe(opened.cookie);
    expect((await call("GET", `${BUSINESS_URL}/api/v1/me`, renewed.body.access_token)).status).toBe(200);

    expect((await session("refresh", opened.cookie)).status).toBe(401);
    expect((await session("refresh", renewed.cookie)).status).toBe(401);

    const again = await session("login", undefined, { email: ROOT.email, password: ROOT.password });
    expect((await session("logout", again.cookie)).status).toBe(204);
    expect((await session("refresh", again.cookie)).status).toBe(401);
  });
});

describe("permission changes in auth-api", () => {
  test("a revoked permission applies to business-api from the next login", async () => {
    const revoked: ApiResponse = await call(
      "DELETE",
      `${AUTH_URL}/api/v1/roles/user/permissions/repair_orders:write`,
      adminToken,
    );
    expect(revoked.status).toBe(200);

    const body = { engine_id: engineId, reported_issue: "Second visit" };
    const withOldToken: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/repair-orders`, operatorToken, body);
    expect(withOldToken.status).toBe(201);

    const freshToken: string = await login(`e2e.user.${RUN_ID}@motorix.ci`, PASSWORD);
    const withFreshToken: ApiResponse = await call("POST", `${BUSINESS_URL}/api/v1/repair-orders`, freshToken, body);
    expect(withFreshToken.status).toBe(403);

    const restored: ApiResponse = await call(
      "PUT",
      `${AUTH_URL}/api/v1/roles/user/permissions/repair_orders:write`,
      adminToken,
    );
    expect(restored.status).toBe(200);
  });

  test("a deactivated account can no longer log in", async () => {
    const deactivated: ApiResponse = await call("DELETE", `${AUTH_URL}/api/v1/users/${operatorId}`, adminToken);
    expect(deactivated.status).toBe(200);
    const response: ApiResponse = await call("POST", `${AUTH_URL}/api/v1/auth/login`, undefined, {
      email: `e2e.user.${RUN_ID}@motorix.ci`,
      password: PASSWORD,
    });
    expect(response.status).toBe(401);
  });
});
