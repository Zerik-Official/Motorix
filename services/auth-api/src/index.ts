/**
 * @file Entry point of auth-api: loads the settings, seeds `root` and starts the HTTP server.
 */

import type { Server } from "node:http";

import { createApp } from "./app";
import { databaseUrl, loadSettings, readPrivateKey, type Settings } from "./core/config";
import { closeServiceLogs, setupServiceLogs } from "./core/log-files";
import { configureLogging, log } from "./core/logging";
import { JwtIssuer } from "./core/security/jwt-issuer";
import { PasswordHasher } from "./core/security/password-hasher";
import { Database } from "./db/database";
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

  const jwtIssuer: JwtIssuer = await JwtIssuer.fromPem(readPrivateKey(settings), settings.jwt);
  const database: Database = new Database({ url: databaseUrl(settings), poolSize: settings.database.poolSize });
  if (!(await database.ping())) {
    log("CRITICAL", "The database is not reachable");
    process.exit(1);
  }

  const rootService: RootAccountService = new RootAccountService(
    new PrismaUserRepository(database.client),
    new PasswordHasher(),
  );
  const seed: RootSeedResult = await rootService.ensureRoot(settings.root);
  log(seed === "unchanged" ? "INFO" : "SUCCESS", `Root account ${seed}`);

  const server: Server = createApp({ settings, database, jwtIssuer }).listen(settings.port, settings.host, () => {
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
