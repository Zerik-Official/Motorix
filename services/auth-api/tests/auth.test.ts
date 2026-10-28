import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import type { UserRecord } from "../src/repositories/user.repository";
import { testContext, type TestContext } from "./support/fakes";

const PASSWORD = "a-good-password";

let context: TestContext;
let app: Express;
let operator: UserRecord;

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

describe("POST /api/v1/auth/login", () => {
  test("returns a token carrying the role and current permissions, plus the account", async () => {
    const response: Response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "Operator@Motorix.Test", password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.token_type).toBe("Bearer");
    expect(response.body.expires_in).toBe(3600);
    expect(response.body.user.id).toBe(operator.id);
    expect(response.body.user).not.toHaveProperty("password_hash");
    expect(response.body.user.permissions).toEqual([
      "clients:read",
      "engines:read",
      "repair_orders:read",
      "repair_orders:write",
    ]);
    expect(await context.jwtVerifier.verify(response.body.access_token)).toBe(operator.id);
    const claims = JSON.parse(Buffer.from(response.body.access_token.split(".")[1], "base64url").toString());
    expect(claims.role).toBe("user");
    expect(claims.permissions).toEqual(response.body.user.permissions);
    expect(claims.aud).toBe("motorix-business-api");
  });

  test("the issued token opens the protected endpoints", async () => {
    const login: Response = await request(app).post("/api/v1/auth/login").send({ email: operator.email, password: PASSWORD });
    const me: Response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${login.body.access_token}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(operator.email);
  });

  test("answers the same 401 for a wrong password, an unknown email and an inactive account", async () => {
    await context.users.create({
      email: "inactive@motorix.test",
      fullName: "Inactive",
      passwordHash: await context.hasher.hash(PASSWORD),
      role: "user",
    });
    const inactive = (await context.users.findByEmail("inactive@motorix.test")) as UserRecord;
    await context.users.update(inactive.id, { isActive: false });

    const responses: Response[] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({ email: operator.email, password: "wrong-password" }),
      request(app).post("/api/v1/auth/login").send({ email: "nobody@motorix.test", password: PASSWORD }),
      request(app).post("/api/v1/auth/login").send({ email: "inactive@motorix.test", password: PASSWORD }),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error).toEqual({ code: "unauthorized", message: "Invalid email or password", details: null });
    }
  });

  test("validates the body", async () => {
    const response: Response = await request(app).post("/api/v1/auth/login").send({ email: "not-an-email" });
    expect(response.status).toBe(422);
    const fields: string[] = response.body.error.details.map((detail: { field: string }) => detail.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });

  test("embeds permissions as stored at login time", async () => {
    context.rolePermissions.rows.user = ["repair_orders:read"];
    const response: Response = await request(app).post("/api/v1/auth/login").send({ email: operator.email, password: PASSWORD });
    expect(response.body.user.permissions).toEqual(["repair_orders:read"]);
  });
});
