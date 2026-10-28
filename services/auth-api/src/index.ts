/**
 * @file Entry point of auth-api: loads the settings, seeds `root` and starts the HTTP server.
 */

import type { Server } from "node:http";

import type { Express } from "express";

import { createApp } from "./app";
import { databaseUrl, loadSettings, readPrivateKey, type Settings } from "./core/config";
import { closeServiceLogs, setupServiceLogs } from "./core/log-files";
import { configureLogging, log } from "./core/logging";
import { DisabledCaptchaVerifier, TurnstileVerifier, type CaptchaVerifier } from "./core/security/captcha";
import { JwtIssuer } from "./core/security/jwt-issuer";
import { JwtVerifier } from "./core/security/jwt-verifier";
import { PasswordHasher } from "./core/security/password-hasher";
import { Database } from "./db/database";
import { PrismaRefreshTokenRepository } from "./repositories/refresh-token.repository";
import { PrismaRolePermissionRepository } from "./repositories/role-permission.repository";
import { PrismaUserRepository } from "./repositories/user.repository";
import { RootAccountService, type RootSeedResult } from "./services/root-account.service";

/**
 * Starts the service and stops it cleanly on SIGINT or SIGTERM.
 */
async function main(): Promise<void> {
  const settings: Settings = loadSettings();
  configureLogging(settings.log.level, settings.log.verbosity, settings.log.suppress);
  if (settings.log.toFile) {
    setupServiceLogs(settings.appName, settings.log.directory);
  }
  log("INFO", `Starting ${settings.appName} in ${settings.environment} environment`);

  const privateKey: string = readPrivateKey(settings);
  const jwtIssuer: JwtIssuer = await JwtIssuer.fromPem(privateKey, settings.jwt);
  const jwtVerifier: JwtVerifier = await JwtVerifier.fromPrivatePem(privateKey, settings.jwt);
  const database: Database = new Database({ url: databaseUrl(settings), poolSize: settings.database.poolSize });
  if (!(await database.ping())) {
    log("CRITICAL", "The database is not reachable");
    process.exit(1);
  }

  const users: PrismaUserRepository = new PrismaUserRepository(database.client);
  const hasher: PasswordHasher = new PasswordHasher();
  const seed: RootSeedResult = await new RootAccountService(users, hasher).ensureRoot(settings.root);
  log(seed === "unchanged" ? "INFO" : "SUCCESS", `Root account ${seed}`);

  const captcha: CaptchaVerifier = settings.turnstile.secretKey
    ? new TurnstileVerifier(settings.turnstile.secretKey, settings.turnstile.verifyUrl)
    : new DisabledCaptchaVerifier();
  if (!settings.turnstile.secretKey) {
    log("WARNING", "TURNSTILE_SECRET_KEY is empty: login does not require human verification");
  }

  const app: Express = createApp({
    settings,
    database,
    jwtIssuer,
    jwtVerifier,
    captcha,
    users,
    rolePermissions: new PrismaRolePermissionRepository(database.client),
    refreshTokens: new PrismaRefreshTokenRepository(database.client),
    hasher,
  });
  const server: Server = app.listen(settings.port, settings.host, () => {
    log("SUCCESS", `Listening on http://${settings.host}:${settings.port}`);
  });

  const shutdown = (signal: string): void => {
    log("INFO", `Received ${signal}, stopping ${settings.appName}`);
    server.close(async () => {
      await database.dispose();
      log("INFO", `Stopped ${settings.appName}`);
      closeServiceLogs();
      process.exit(0);
    });
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  log("CRITICAL", `Failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
