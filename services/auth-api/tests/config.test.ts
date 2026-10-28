import { describe, expect, test } from "bun:test";

import { ConfigurationError, databaseUrl, loadSettings, readPrivateKey, type Settings } from "../src/core/config";
import { BASE_ENV } from "./support/fakes";

describe("loadSettings", () => {
  test("applies defaults and normalizes the root email", () => {
    const settings: Settings = loadSettings(BASE_ENV);
    expect(settings.port).toBe(3000);
    expect(settings.jwt.issuer).toBe("motorix-auth-api");
    expect(settings.jwt.audience).toBe("motorix-business-api");
    expect(settings.root.email).toBe("root@motorix.local");
    expect(settings.log.toFile).toBe(false);
  });

  test("splits the CORS origins", () => {
    const settings: Settings = loadSettings({ ...BASE_ENV, CORS_ORIGINS: "http://a.test, ,http://b.test" });
    expect(settings.corsOrigins).toEqual(["http://a.test", "http://b.test"]);
  });

  test("rejects a missing root password", () => {
    const env: Record<string, string> = { ...BASE_ENV };
    delete env.ROOT_PASSWORD;
    expect(() => loadSettings(env)).toThrow(ConfigurationError);
  });

  test("rejects a short root password and an invalid port", () => {
    expect(() => loadSettings({ ...BASE_ENV, ROOT_PASSWORD: "short" })).toThrow(/ROOT_PASSWORD/);
    expect(() => loadSettings({ ...BASE_ENV, PORT: "70000" })).toThrow(/PORT/);
  });
});

describe("databaseUrl", () => {
  test("escapes the credentials", () => {
    const settings: Settings = loadSettings({ ...BASE_ENV, DB_PASSWORD: "p@ss:word" });
    expect(databaseUrl(settings)).toBe("postgresql://auth_service:p%40ss%3Aword@localhost:5432/auth_db");
  });
});

describe("readPrivateKey", () => {
  test("prefers the inline key and restores its line breaks", () => {
    const settings: Settings = loadSettings({ ...BASE_ENV, JWT_PRIVATE_KEY: "line1\\nline2" });
    expect(readPrivateKey(settings)).toBe("line1\nline2");
  });

  test("fails when no key is configured", () => {
    const settings: Settings = loadSettings({ ...BASE_ENV, JWT_PRIVATE_KEY: "" });
    expect(() => readPrivateKey(settings)).toThrow(ConfigurationError);
  });
});
