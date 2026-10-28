import { beforeAll, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import { testContext } from "./support/fakes";

beforeAll(() => configureLogging("CRITICAL", 1, ""));

describe("API reference", () => {
  test("serves the OpenAPI document with every endpoint and the bearer scheme", async () => {
    const app: Express = createApp(await testContext());
    const response: Response = await request(app).get("/openapi.json");
    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe("3.1.0");
    expect(response.body.components.securitySchemes.bearerAuth).toMatchObject({ type: "http", scheme: "bearer" });
    expect(Object.keys(response.body.paths).sort()).toEqual([
      "/api/v1/auth/login",
      "/api/v1/auth/logout",
      "/api/v1/auth/refresh",
      "/api/v1/roles",
      "/api/v1/roles/{role}/permissions/{permission}",
      "/api/v1/users",
      "/api/v1/users/me",
      "/api/v1/users/me/password",
      "/api/v1/users/{id}",
      "/health",
    ]);
    const login = response.body.paths["/api/v1/auth/login"].post;
    expect(Object.keys(login.responses)).toEqual(expect.arrayContaining(["200", "400", "401", "422", "429"]));
    expect(login.security).toBeUndefined();
    expect(response.body.paths["/api/v1/users"].post.security).toEqual([{ bearerAuth: [] }]);
  });

  test("serves the interactive reference", async () => {
    const app: Express = createApp(await testContext());
    const response: Response = await request(app).get("/docs/").redirects(1);
    expect(response.status).toBe(200);
    expect(response.text).toContain("swagger-ui");
  });

  test("can be turned off", async () => {
    const app: Express = createApp(await testContext({ docsEnabled: false }));
    expect((await request(app).get("/openapi.json")).status).toBe(404);
    expect((await request(app).get("/docs/")).status).toBe(404);
  });
});
