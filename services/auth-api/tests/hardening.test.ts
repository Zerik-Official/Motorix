import { beforeAll, describe, expect, test } from "bun:test";
import type { Express } from "express";
import request, { type Response } from "supertest";

import { createApp } from "../src/app";
import { loadSettings } from "../src/core/config";
import { CaptchaError, ServiceUnavailableError } from "../src/core/errors";
import { configureLogging } from "../src/core/logging";
import { TurnstileVerifier } from "../src/core/security/captcha";
import { BASE_ENV, testContext, testSettings, type TestContext } from "./support/fakes";

const PASSWORD = "a-good-password";

/**
 * Builds a fetch stand-in that records the request and answers with a fixed result.
 *
 * @param answer - Body returned, or an error thrown, or an HTTP status to fail with.
 * @returns The fetch function and the bodies it received.
 */
function fakeFetch(answer: object | Error | number): { fetcher: typeof fetch; bodies: URLSearchParams[] } {
  const bodies: URLSearchParams[] = [];
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    bodies.push(init?.body as URLSearchParams);
    if (answer instanceof Error) {
      throw answer;
    }
    if (typeof answer === "number") {
      return new Response("error", { status: answer }) as unknown as Response;
    }
    return new Response(JSON.stringify(answer), { status: 200 }) as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetcher, bodies };
}

/**
 * Builds a context with one active operator account.
 *
 * @param overrides - Settings to replace.
 * @returns The context and its application.
 */
async function withOperator(overrides = {}): Promise<{ context: TestContext; app: Express }> {
  const context: TestContext = await testContext(overrides);
  await context.users.create({
    email: "operator@motorix.test",
    fullName: "Operator",
    passwordHash: await context.hasher.hash(PASSWORD),
    role: "user",
  });
  return { context, app: createApp(context) };
}

beforeAll(() => configureLogging("CRITICAL", 1, ""));

describe("TurnstileVerifier", () => {
  test("sends secret, token and client address, and accepts a successful answer", async () => {
    const { fetcher, bodies } = fakeFetch({ success: true });
    await new TurnstileVerifier("secret", "https://turnstile.test", fetcher).verify("token", "203.0.113.7");
    expect(bodies[0]?.get("secret")).toBe("secret");
    expect(bodies[0]?.get("response")).toBe("token");
    expect(bodies[0]?.get("remoteip")).toBe("203.0.113.7");
  });

  test("rejects a missing token without calling Cloudflare", async () => {
    const { fetcher, bodies } = fakeFetch({ success: true });
    await expect(new TurnstileVerifier("secret", "https://turnstile.test", fetcher).verify(undefined)).rejects.toThrow(
      CaptchaError,
    );
    expect(bodies).toHaveLength(0);
  });

  test("rejects a token Cloudflare does not accept, with its reasons", async () => {
    const { fetcher } = fakeFetch({ success: false, "error-codes": ["timeout-or-duplicate"] });
    const verifier: TurnstileVerifier = new TurnstileVerifier("secret", "https://turnstile.test", fetcher);
    const error: unknown = await verifier.verify("token").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(CaptchaError);
    expect((error as CaptchaError).details).toEqual({ reasons: ["timeout-or-duplicate"] });
  });

  test("reports Cloudflare being unreachable or failing as unavailable", async () => {
    for (const answer of [new Error("network down"), 500]) {
      const { fetcher } = fakeFetch(answer);
      await expect(new TurnstileVerifier("secret", "https://turnstile.test", fetcher).verify("token")).rejects.toThrow(
        ServiceUnavailableError,
      );
    }
  });
});

describe("login with human verification", () => {
  test("checks the challenge before the password, with the client token and address", async () => {
    const { context, app } = await withOperator();
    const response: Response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "operator@motorix.test", password: PASSWORD, turnstile_token: "widget-token" });
    expect(response.status).toBe(200);
    expect(context.captcha.calls).toHaveLength(1);
    expect(context.captcha.calls[0]?.token).toBe("widget-token");
    expect(context.captcha.calls[0]?.remoteIp).toBeDefined();
  });

  test("a failed challenge answers 400 even with the right password", async () => {
    const { context, app } = await withOperator();
    context.captcha.failure = new CaptchaError("The human verification did not pass");
    const response: Response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "operator@motorix.test", password: PASSWORD, turnstile_token: "bad" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("captcha_failed");
    expect(response.body).not.toHaveProperty("access_token");
  });
});

describe("rate limiting", () => {
  test("blocks repeated failed logins with 429 but does not count successful ones", async () => {
    const { app } = await withOperator({ rateLimit: { windowSeconds: 60, max: 100, loginWindowSeconds: 60, loginMax: 2 } });
    const login = (password: string): Promise<Response> =>
      request(app).post("/api/v1/auth/login").send({ email: "operator@motorix.test", password });

    expect((await login(PASSWORD)).status).toBe(200);
    expect((await login(PASSWORD)).status).toBe(200);
    expect((await login(PASSWORD)).status).toBe(200);
    expect((await login("wrong-password")).status).toBe(401);
    expect((await login("wrong-password")).status).toBe(401);
    const blocked: Response = await login(PASSWORD);

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("too_many_requests");
    expect(blocked.headers["retry-after"]).toBeDefined();
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
  });

  test("limits the whole API but never the health check", async () => {
    const { app } = await withOperator({ rateLimit: { windowSeconds: 60, max: 2, loginWindowSeconds: 60, loginMax: 100 } });
    await request(app).get("/api/v1/users/me");
    await request(app).get("/api/v1/users/me");
    const blocked: Response = await request(app).get("/api/v1/users/me");
    const health: Response = await request(app).get("/health");
    expect(blocked.status).toBe(429);
    expect(health.status).toBe(200);
  });

  test("ignores X-Forwarded-For unless a proxy is trusted", async () => {
    const limits = { windowSeconds: 60, max: 1, loginWindowSeconds: 60, loginMax: 100 };
    const direct: Express = (await withOperator({ rateLimit: limits })).app;
    await request(direct).get("/api/v1/users/me").set("X-Forwarded-For", "198.51.100.1");
    const spoofed: Response = await request(direct).get("/api/v1/users/me").set("X-Forwarded-For", "198.51.100.2");
    expect(spoofed.status).toBe(429);

    const proxied: Express = (await withOperator({ rateLimit: limits, trustProxy: 1 })).app;
    await request(proxied).get("/api/v1/users/me").set("X-Forwarded-For", "198.51.100.1");
    const otherClient: Response = await request(proxied).get("/api/v1/users/me").set("X-Forwarded-For", "198.51.100.2");
    expect(otherClient.status).toBe(401);
  });
});

describe("hardening settings", () => {
  test("defaults keep a strict login limit and no trusted proxy", () => {
    const settings = loadSettings(BASE_ENV);
    expect(settings.trustProxy).toBe(0);
    expect(settings.rateLimit.loginMax).toBe(10);
    expect(settings.turnstile.secretKey).toBe("");
    expect(testSettings().turnstile.secretKey).toBe("");
  });

  test("production refuses to start without a Turnstile secret", () => {
    expect(() => loadSettings({ ...BASE_ENV, ENVIRONMENT: "production" })).toThrow(/TURNSTILE_SECRET_KEY/);
    expect(() =>
      loadSettings({ ...BASE_ENV, ENVIRONMENT: "production", TURNSTILE_SECRET_KEY: "secret" }),
    ).not.toThrow();
  });
});
