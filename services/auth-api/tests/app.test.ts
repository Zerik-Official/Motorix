import { beforeAll, describe, expect, test } from "bun:test";
import express, { type Express, type Request } from "express";
import { generateKeyPair } from "jose";
import request, { type Response } from "supertest";
import { z } from "zod";

import { createApp } from "../src/app";
import { configureLogging } from "../src/core/logging";
import { ConflictError, errorHandler, notFoundHandler } from "../src/core/errors";
import { JwtIssuer } from "../src/core/security/jwt-issuer";
import { FakeDatabase, testSettings } from "./support/fakes";

let jwtIssuer: JwtIssuer;

beforeAll(async () => {
  configureLogging("CRITICAL", 1, "");
  const { privateKey } = await generateKeyPair("RS256");
  jwtIssuer = new JwtIssuer(privateKey, { issuer: "i", audience: "a", expiresInSeconds: 60 });
});

describe("GET /health", () => {
  test("answers 200 when the database answers", async () => {
    const app: Express = createApp({ settings: testSettings(), database: new FakeDatabase(true), jwtIssuer });
    const response: Response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "ok" });
  });

  test("answers 503 when the database is down", async () => {
    const app: Express = createApp({ settings: testSettings(), database: new FakeDatabase(false), jwtIssuer });
    const response: Response = await request(app).get("/health");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("unavailable");
  });

  test("sends security headers and hides the framework", async () => {
    const app: Express = createApp({ settings: testSettings(), database: new FakeDatabase(), jwtIssuer });
    const response: Response = await request(app).get("/health");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  test("allows only the configured CORS origins", async () => {
    const settings = testSettings({ corsOrigins: ["http://localhost:5173"] });
    const app: Express = createApp({ settings, database: new FakeDatabase(), jwtIssuer });
    const allowed: Response = await request(app).get("/health").set("Origin", "http://localhost:5173");
    const denied: Response = await request(app).get("/health").set("Origin", "http://evil.test");
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

describe("error handling", () => {
  test("unknown routes answer 404 with the shared error body", async () => {
    const app: Express = createApp({ settings: testSettings(), database: new FakeDatabase(), jwtIssuer });
    const response: Response = await request(app).get("/missing");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: { code: "not_found", message: "Route GET /missing not found", details: null } });
  });

  const probe: Express = express();
  probe.use(express.json());
  probe.post("/validate", (req: Request) => {
    z.object({ email: z.email() }).parse(req.body);
  });
  probe.get("/conflict", () => {
    throw new ConflictError("Duplicated", { field: "email" });
  });
  probe.get("/boom", async () => {
    throw new Error("secret internals");
  });
  probe.use(notFoundHandler);
  probe.use(errorHandler);

  test("application errors keep their status, code and details", async () => {
    const response: Response = await request(probe).get("/conflict");
    expect(response.status).toBe(409);
    expect(response.body.error).toEqual({ code: "conflict", message: "Duplicated", details: { field: "email" } });
  });

  test("schema errors answer 422 with the invalid fields", async () => {
    const response: Response = await request(probe).post("/validate").send({ email: "nope" });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details[0].field).toBe("email");
  });

  test("malformed JSON answers 400", async () => {
    const response: Response = await request(probe).post("/validate").set("Content-Type", "application/json").send("{bad");
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("invalid_json");
  });

  test("unexpected errors answer 500 without leaking internals", async () => {
    const response: Response = await request(probe).get("/boom");
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("secret internals");
  });
});
