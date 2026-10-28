import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import { PERMISSIONS } from "../src/core/security/permissions";
import type { Role } from "../src/core/security/roles";
import { testContext, type TestContext } from "./support/fakes";

let context: TestContext;
let app: Express;
let tokens: Record<Role, string>;

beforeAll(() => configureLogging("CRITICAL", 1, ""));

beforeEach(async () => {
  context = await testContext();
  app = createApp(context);
  const entries = await Promise.all(
    (["root", "admin", "user"] as const).map(async (role) => {
      const user = await context.users.create({
        email: `${role}@motorix.test`,
        fullName: role,
        passwordHash: "unused",
        role,
      });
      const { accessToken } = await context.jwtIssuer.issue({ id: user.id, role, permissions: [] });
      return [role, `Bearer ${accessToken}`] as const;
    }),
  );
  tokens = Object.fromEntries(entries) as Record<Role, string>;
});

/**
 * Sends a grant or revoke request.
 *
 * @param method - `put` to grant, `delete` to revoke.
 * @param caller - Role whose token is used.
 * @param role - Target role.
 * @param permission - Permission changed.
 * @returns The response.
 */
function change(method: "put" | "delete", caller: Role, role: string, permission: string): Promise<Response> {
  return request(app)[method](`/api/v1/roles/${role}/permissions/${permission}`).set("Authorization", tokens[caller]);
}

describe("GET /api/v1/roles", () => {
  test("returns the catalog and every role, marking what the caller may edit", async () => {
    const response: Response = await request(app).get("/api/v1/roles").set("Authorization", tokens.admin);
    expect(response.status).toBe(200);
    expect(response.body.catalog).toEqual([...PERMISSIONS]);
    expect(response.body.roles).toEqual([
      { role: "root", permissions: [...PERMISSIONS], editable: false },
      { role: "admin", permissions: expect.any(Array), editable: false },
      { role: "user", permissions: ["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"], editable: true },
    ]);
  });

  test("lets root edit admin and user", async () => {
    const response: Response = await request(app).get("/api/v1/roles").set("Authorization", tokens.root);
    expect(response.body.roles.map((role: { editable: boolean }) => role.editable)).toEqual([false, true, true]);
  });

  test("is forbidden without permissions:manage", async () => {
    const response: Response = await request(app).get("/api/v1/roles").set("Authorization", tokens.user);
    expect(response.status).toBe(403);
  });
});

describe("grant and revoke", () => {
  test("admin grants and revokes a permission of user", async () => {
    const granted: Response = await change("put", "admin", "user", "clients:write");
    expect(granted.status).toBe(200);
    expect(granted.body.permissions).toContain("clients:write");
    expect(granted.body.editable).toBe(true);

    const revoked: Response = await change("delete", "admin", "user", "clients:write");
    expect(revoked.status).toBe(200);
    expect(revoked.body.permissions).not.toContain("clients:write");
  });

  test("granting twice or revoking an absent permission changes nothing", async () => {
    await change("put", "admin", "user", "engines:write");
    const again: Response = await change("put", "admin", "user", "engines:write");
    const absent: Response = await change("delete", "admin", "user", "users:manage");
    expect(again.status).toBe(200);
    expect(again.body.permissions.filter((p: string) => p === "engines:write")).toHaveLength(1);
    expect(absent.status).toBe(200);
  });

  test("the change applies to the next request of an account of that role", async () => {
    await change("delete", "admin", "user", "repair_orders:write");
    const me: Response = await request(app).get("/api/v1/users/me").set("Authorization", tokens.user);
    expect(me.body.permissions).not.toContain("repair_orders:write");
  });

  test("root changes admin, admin cannot change admin or root", async () => {
    expect((await change("delete", "root", "admin", "engines:write")).status).toBe(200);
    expect((await change("delete", "admin", "admin", "engines:read")).status).toBe(403);
    expect((await change("delete", "admin", "root", "engines:read")).status).toBe(403);
    expect((await change("delete", "root", "root", "engines:read")).status).toBe(403);
  });

  test("nobody grants a permission they do not hold", async () => {
    await change("delete", "root", "admin", "clients:write");
    const response: Response = await change("put", "admin", "user", "clients:write");
    expect(response.status).toBe(403);
    expect(response.body.error.message).toContain("you hold");
  });

  test("losing permissions:manage takes the endpoints away at once", async () => {
    await change("delete", "root", "admin", "permissions:manage");
    const response: Response = await request(app).get("/api/v1/roles").set("Authorization", tokens.admin);
    expect(response.status).toBe(403);
  });

  test("rejects unknown permissions and roles", async () => {
    expect((await change("put", "root", "user", "billing:write")).status).toBe(422);
    expect((await change("put", "root", "guest", "clients:read")).status).toBe(422);
  });
});
