import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

/**
 * Root folder of the service, where `.env`, `prisma/` and `logs/` live.
 */
export const BASE_DIR: string = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Deployment environments the service can run in.
 */
export const ENVIRONMENTS = ["local", "test", "staging", "production"] as const;

/**
 * Deployment environment the service runs in.
 */
export type Environment = (typeof ENVIRONMENTS)[number];

/**
 * Endpoint where Cloudflare validates Turnstile tokens.
 */
export const TURNSTILE_VERIFY_URL: string = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const settingsSchema = z
  .object({
    APP_NAME: z.string().min(1).default("auth-api"),
    ENVIRONMENT: z.enum(ENVIRONMENTS).default("local"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    CORS_ORIGINS: z.string().default(""),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    DOCS_ENABLED: z.stringbool().default(true),

    DB_HOST: z.string().min(1).default("localhost"),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    DB_NAME: z.string().min(1).default("auth_db"),
    DB_USER: z.string().min(1).default("auth_service"),
    DB_PASSWORD: z.string().default(""),
    DB_POOL_SIZE: z.coerce.number().int().min(1).default(5),

    JWT_PRIVATE_KEY_PATH: z.string().default(""),
    JWT_PRIVATE_KEY: z.string().default(""),
    JWT_ISSUER: z.string().min(1).default("motorix-auth-api"),
    JWT_AUDIENCE: z.string().min(1).default("motorix-business-api"),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).default(43200),
    REFRESH_COOKIE_SECURE: z.stringbool().default(true),

    MAX_PAGE_SIZE: z.coerce.number().int().min(1).default(100),

    TURNSTILE_SECRET_KEY: z.string().default(""),
    TURNSTILE_VERIFY_URL: z.url().default(TURNSTILE_VERIFY_URL),

    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),

    ROOT_EMAIL: z.email(),
    ROOT_PASSWORD: z.string().min(12),
    ROOT_FULL_NAME: z.string().min(1).max(150).default("Root"),

    LOG_LEVEL: z.string().default("INFO"),
    LOG_VERBOSITY: z.coerce.number().int().min(1).default(1),
    LOG_SUPPRESS: z.string().default(""),
    LOG_TO_FILE: z.stringbool().default(true),
    LOG_DIR: z.string().min(1).default("logs"),
  })
  .refine((env) => env.ENVIRONMENT !== "production" || env.TURNSTILE_SECRET_KEY.trim() !== "", {
    message: "is required in production",
    path: ["TURNSTILE_SECRET_KEY"],
  })
  .refine((env) => env.ENVIRONMENT !== "production" || env.REFRESH_COOKIE_SECURE, {
    message: "must be true in production",
    path: ["REFRESH_COOKIE_SECURE"],
  });

/**
 * Raw environment variables of the service after validation.
 */
type RawSettings = z.infer<typeof settingsSchema>;

/**
 * Every setting of the service, read from environment variables.
 */
export interface Settings {
  appName: string;
  environment: Environment;
  host: string;
  port: number;
  corsOrigins: string[];
  trustProxy: number;
  docsEnabled: boolean;
  maxPageSize: number;
  turnstile: {
    secretKey: string;
    verifyUrl: string;
  };
  rateLimit: {
    windowSeconds: number;
    max: number;
    loginWindowSeconds: number;
    loginMax: number;
  };
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    poolSize: number;
  };
  jwt: {
    privateKeyPath: string;
    privateKey: string;
    issuer: string;
    audience: string;
    expiresInSeconds: number;
  };
  session: {
    refreshTokenTtlSeconds: number;
    secureCookie: boolean;
  };
  root: {
    email: string;
    password: string;
    fullName: string;
  };
  log: {
    level: string;
    verbosity: number;
    suppress: string;
    toFile: boolean;
    directory: string;
  };
}

/**
 * Raised when the environment does not describe a valid configuration.
 */
export class ConfigurationError extends Error {
  /**
   * @param message - Description of every invalid variable.
   */
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Resolves a path relative to the service root.
 *
 * @param path - Absolute path or path relative to the service root.
 * @returns The absolute path.
 */
function fromServiceRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(BASE_DIR, path);
}

/**
 * Validates the environment and builds the settings of the service.
 *
 * @param env - Variables to read; the process environment when omitted.
 * @returns The settings.
 * @throws ConfigurationError When a variable is missing or invalid.
 */
export function loadSettings(env: Record<string, string | undefined> = process.env): Settings {
  const parsed = settingsSchema.safeParse(env);
  if (!parsed.success) {
    const problems: string = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigurationError(`Invalid environment: ${problems}`);
  }
  const raw: RawSettings = parsed.data;
  return {
    appName: raw.APP_NAME,
    environment: raw.ENVIRONMENT,
    host: raw.HOST,
    port: raw.PORT,
    corsOrigins: raw.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    trustProxy: raw.TRUST_PROXY,
    docsEnabled: raw.DOCS_ENABLED,
    maxPageSize: raw.MAX_PAGE_SIZE,
    turnstile: {
      secretKey: raw.TURNSTILE_SECRET_KEY.trim(),
      verifyUrl: raw.TURNSTILE_VERIFY_URL,
    },
    rateLimit: {
      windowSeconds: raw.RATE_LIMIT_WINDOW_SECONDS,
      max: raw.RATE_LIMIT_MAX,
      loginWindowSeconds: raw.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
      loginMax: raw.LOGIN_RATE_LIMIT_MAX,
    },
    database: {
      host: raw.DB_HOST,
      port: raw.DB_PORT,
      name: raw.DB_NAME,
      user: raw.DB_USER,
      password: raw.DB_PASSWORD,
      poolSize: raw.DB_POOL_SIZE,
    },
    jwt: {
      privateKeyPath: raw.JWT_PRIVATE_KEY_PATH,
      privateKey: raw.JWT_PRIVATE_KEY,
      issuer: raw.JWT_ISSUER,
      audience: raw.JWT_AUDIENCE,
      expiresInSeconds: raw.JWT_EXPIRES_IN_SECONDS,
    },
    session: {
      refreshTokenTtlSeconds: raw.REFRESH_TOKEN_TTL_SECONDS,
      secureCookie: raw.REFRESH_COOKIE_SECURE,
    },
    root: {
      email: raw.ROOT_EMAIL.trim().toLowerCase(),
      password: raw.ROOT_PASSWORD,
      fullName: raw.ROOT_FULL_NAME,
    },
    log: {
      level: raw.LOG_LEVEL,
      verbosity: raw.LOG_VERBOSITY,
      suppress: raw.LOG_SUPPRESS,
      toFile: raw.LOG_TO_FILE,
      directory: fromServiceRoot(raw.LOG_DIR),
    },
  };
}

/**
 * Builds the connection URL of the service database.
 *
 * @param settings - Settings of the service.
 * @returns The PostgreSQL connection URL.
 */
export function databaseUrl(settings: Settings): string {
  const { host, port, name, user, password } = settings.database;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

/**
 * Loads the PEM private key used to sign tokens.
 *
 * @param settings - Settings of the service.
 * @returns The inline key when `JWT_PRIVATE_KEY` is set, otherwise the contents of `JWT_PRIVATE_KEY_PATH`.
 * @throws ConfigurationError When neither `JWT_PRIVATE_KEY` nor `JWT_PRIVATE_KEY_PATH` is set.
 */
export function readPrivateKey(settings: Settings): string {
  if (settings.jwt.privateKey.trim()) {
    return settings.jwt.privateKey.replaceAll("\\n", "\n");
  }
  if (!settings.jwt.privateKeyPath.trim()) {
    throw new ConfigurationError("JWT_PRIVATE_KEY or JWT_PRIVATE_KEY_PATH must be set");
  }
  return readFileSync(fromServiceRoot(settings.jwt.privateKeyPath), "utf-8");
}
