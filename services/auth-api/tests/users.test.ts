import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import { PERMISSIONS } from "../src/core/security/permissions";
import type { Role } from "../src/core/security/roles";
import type { UserRecord } from "../src/repositories/user.repository";
import { testContext, type TestContext } from "./support/fakes";

const PASSWORD = "a-good-password";

let context: TestContext;
let app: Express;
let accounts: Record<Role, UserRecord>;
let tokens: Record<Role, string>;

/**
 * Stores an account with a real hash and signs a token for it.
 *
 * @param role - Role of the account.
 * @returns The account and its bearer token.
 */
async function seed(role: Role): Promise<{ user: UserRecord; token: string }> {
  const user: UserRecord = await context.users.create({
    email: `${role}@motorix.test`,
    fullName: `The ${role}`,
    passwordHash: await context.hasher.hash(PASSWORD),
    role,
  });
  const { accessToken } = await context.jwtIssuer.issue({ id: user.id, role, permissions: [] });
  return { user, token: accessToken };
}

/**
 * Builds the authorization header of a role.
 *
 * @param role - Role whose token is used.
 * @returns The header value.
 */
function bearer(role: Role): string {
  return `Bearer ${tokens[role]}`;
}

beforeAll(() => configureLogging("CRITICAL", 1, ""));

beforeEach(async () => {
  context = await testContext();
  app = createApp(context);
  const root = await seed("root");
  const admin = await seed("admin");
  const user = await seed("user");
  accounts = { root: root.user, admin: admin.user, user: user.user };
  tokens = { root: root.token, admin: admin.token, user: user.token };
});

describe("authentication", () => {
  test("requires a bearer token", async () => {
    const response: Response = await request(app).get("/api/v1/users/me");
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
  });

  test("rejects a forged token", async () => {
    const response: Response = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer abc.def.ghi");
    expect(response.status).toBe(401);
  });

  test("rejects the token of a deactivated account at once", async () => {
    await context.users.update(accounts.user.id, { isActive: false });
    const response: Response = await request(app).get("/api/v1/users/me").set("Authorization", bearer("user"));
    expect(response.status).toBe(401);
  });
});

describe("GET /api/v1/users/me", () => {
  test("returns the own account with current permissions and no password hash", async () => {
    const response: Response = await request(app).get("/api/v1/users/me").set("Authorization", bearer("user"));
    expect(response.status).toBe(200);
    expect(response.body.email).toBe("user@motorix.test");
    expect(response.body.permissions).toEqual(["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"]);
    expect(response.body).not.toHaveProperty("password_hash");
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  test("gives root the whole catalog", async () => {
    const response: Response = await request(app).get("/api/v1/users/me").set("Authorization", bearer("root"));
    expect(response.body.permissions).toEqual([...PERMISSIONS]);
  });

  test("reads permissions from storage, not from the token", async () => {
    context.rolePermissions.rows.user = ["clients:read"];
    const response: Response = await request(app).get("/api/v1/users/me").set("Authorization", bearer("user"));
    expect(response.body.permissions).toEqual(["clients:read"]);
  });
});

describe("POST /api/v1/users", () => {
  const body = { email: "New.Operator@Motorix.Test", full_name: "New operator", password: PASSWORD };

  test("lets admin register a user, normalizing the email and hashing the password", async () => {
    const response: Response = await request(app).post("/api/v1/users").set("Authorization", bearer("admin")).send(body);
    expect(response.status).toBe(201);
    expect(response.body.email).toBe("new.operator@motorix.test");
    expect(response.body.role).toBe("user");
    const stored = await context.users.findById(response.body.id);
    expect(stored?.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  test("lets root register an admin but not admin", async () => {
    const byRoot: Response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", bearer("root"))
      .send({ ...body, role: "admin" });
    const byAdmin: Response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", bearer("admin"))
      .send({ ...body, email: "other@motorix.test", role: "admin" });
    expect(byRoot.status).toBe(201);
    expect(byAdmin.status).toBe(403);
  });

  test("never creates a root", async () => {
    const response: Response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", bearer("root"))
      .send({ ...body, role: "root" });
    expect(response.status).toBe(422);
  });

  test("forbids it to user, which lacks users:manage", async () => {
    const response: Response = await request(app).post("/api/v1/users").set("Authorization", bearer("user")).send(body);
    expect(response.status).toBe(403);
    expect(response.body.error.details).toEqual({ permission: "users:manage" });
  });

  test("forbids it to admin once users:manage is revoked from its role", async () => {
    context.rolePermissions.rows.admin = ["clients:read"];
    const response: Response = await request(app).post("/api/v1/users").set("Authorization", bearer("admin")).send(body);
    expect(response.status).toBe(403);
  });

  test("answers 409 for a duplicated email", async () => {
    const response: Response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", bearer("admin"))
      .send({ ...body, email: "USER@motorix.test" });
    expect(response.status).toBe(409);
  });

  test("validates the body and rejects unknown fields", async () => {
    const response: Response = await request(app)
      .post("/api/v1/users")
      .set("Authorization", bearer("admin"))
      .send({ email: "bad", full_name: "", password: "short", is_admin: true });
    expect(response.status).toBe(422);
    const fields: string[] = response.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "full_name", "password"]));
  });
});

describe("GET /api/v1/users", () => {
  test("paginates, filters and searches", async () => {
    const all: Response = await request(app).get("/api/v1/users?limit=2").set("Authorization", bearer("admin"));
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items).toHaveLength(2);
    expect(all.body.limit).toBe(2);

    const admins: Response = await request(app).get("/api/v1/users?role=admin").set("Authorization", bearer("admin"));
    expect(admins.body.items.map((item: { role: string }) => item.role)).toEqual(["admin"]);

    const search: Response = await request(app).get("/api/v1/users?search=THE%20USER").set("Authorization", bearer("admin"));
    expect(search.body.total).toBe(1);
  });

  test("caps the page size", async () => {
    const response: Response = await request(app).get("/api/v1/users?limit=1000").set("Authorization", bearer("admin"));
    expect(response.body.limit).toBe(100);
  });

  test("is forbidden to user", async () => {
    const response: Response = await request(app).get("/api/v1/users").set("Authorization", bearer("user"));
    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/users/:id", () => {
  test("lets anyone read their own account but not others without users:manage", async () => {
    const own: Response = await request(app).get(`/api/v1/users/${accounts.user.id}`).set("Authorization", bearer("user"));
    const other: Response = await request(app).get(`/api/v1/users/${accounts.admin.id}`).set("Authorization", bearer("user"));
    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
  });

  test("answers 404 for an unknown id and 422 for a malformed one", async () => {
    const missing: Response = await request(app)
      .get(`/api/v1/users/${crypto.randomUUID()}`)
      .set("Authorization", bearer("admin"));
    const malformed: Response = await request(app).get("/api/v1/users/123").set("Authorization", bearer("admin"));
    expect(missing.status).toBe(404);
    expect(malformed.status).toBe(422);
  });
});

describe("PUT /api/v1/users/:id", () => {
  const update = { email: "user@motorix.test", full_name: "Renamed", role: "user", is_active: true };

  test("lets admin edit a user and reset its password", async () => {
    const response: Response = await request(app)
      .put(`/api/v1/users/${accounts.user.id}`)
      .set("Authorization", bearer("admin"))
      .send({ ...update, password: "a-brand-new-password" });
    expect(response.status).toBe(200);
    expect(response.body.full_name).toBe("Renamed");
    const stored = await context.users.findById(accounts.user.id);
    expect(await context.hasher.verify("a-brand-new-password", stored?.passwordHash ?? "")).toBe(true);
  });

  test("forbids admin to promote a user to admin", async () => {
    const response: Response = await request(app)
      .put(`/api/v1/users/${accounts.user.id}`)
      .set("Authorization", bearer("admin"))
      .send({ ...update, role: "admin" });
    expect(response.status).toBe(403);
  });

  test("forbids admin to edit itself, another admin or root", async () => {
    const self: Response = await request(app)
      .put(`/api/v1/users/${accounts.admin.id}`)
      .set("Authorization", bearer("admin"))
      .send({ ...update, email: "admin@motorix.test" });
    const root: Response = await request(app)
      .put(`/api/v1/users/${accounts.root.id}`)
      .set("Authorization", bearer("admin"))
      .send({ ...update, email: "root@motorix.test" });
    expect(self.status).toBe(403);
    expect(root.status).toBe(403);
  });

  test("lets root demote an admin, but never edit root", async () => {
    const demote: Response = await request(app)
      .put(`/api/v1/users/${accounts.admin.id}`)
      .set("Authorization", bearer("root"))
      .send({ ...update, email: "admin@motorix.test" });
    const self: Response = await request(app)
      .put(`/api/v1/users/${accounts.root.id}`)
      .set("Authorization", bearer("root"))
      .send({ ...update, email: "root@motorix.test" });
    expect(demote.status).toBe(200);
    expect(demote.body.role).toBe("user");
    expect(self.status).toBe(403);
  });

  test("answers 409 when the new email belongs to another account", async () => {
    const response: Response = await request(app)
      .put(`/api/v1/users/${accounts.user.id}`)
      .set("Authorization", bearer("root"))
      .send({ ...update, email: "admin@motorix.test" });
    expect(response.status).toBe(409);
  });
});

describe("DELETE /api/v1/users/:id", () => {
  test("deactivates a user without deleting it, which then cannot authenticate", async () => {
    const response: Response = await request(app)
      .delete(`/api/v1/users/${accounts.user.id}`)
      .set("Authorization", bearer("admin"));
    const after: Response = await request(app).get("/api/v1/users/me").set("Authorization", bearer("user"));
    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(false);
    expect(context.users.users.has(accounts.user.id)).toBe(true);
    expect(after.status).toBe(401);
  });

  test("forbids deactivating root, even to root", async () => {
    const response: Response = await request(app)
      .delete(`/api/v1/users/${accounts.root.id}`)
      .set("Authorization", bearer("root"));
    expect(response.status).toBe(403);
  });
});

describe("PUT /api/v1/users/me/password", () => {
  test("changes the own password after checking the current one", async () => {
    const response: Response = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", bearer("user"))
      .send({ current_password: PASSWORD, new_password: "a-brand-new-password" });
    expect(response.status).toBe(204);
    const stored = await context.users.findById(accounts.user.id);
    expect(await context.hasher.verify("a-brand-new-password", stored?.passwordHash ?? "")).toBe(true);
  });

  test("rejects a wrong current password and a repeated one", async () => {
    const wrong: Response = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", bearer("user"))
      .send({ current_password: "not-the-password", new_password: "a-brand-new-password" });
    const repeated: Response = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", bearer("user"))
      .send({ current_password: PASSWORD, new_password: PASSWORD });
    expect(wrong.status).toBe(422);
    expect(repeated.status).toBe(422);
  });

  test("refuses it for root, whose password lives in the environment", async () => {
    const response: Response = await request(app)
      .put("/api/v1/users/me/password")
      .set("Authorization", bearer("root"))
      .send({ current_password: PASSWORD, new_password: "a-brand-new-password" });
    expect(response.status).toBe(422);
  });
});
