import { defineConfig } from "prisma/config";

/**
 * Builds the connection URL of the service database from the `DB_*` variables, the same ones the
 * service reads at runtime, so the Prisma CLI and the API never point at different databases.
 *
 * @returns The PostgreSQL connection URL.
 */
function databaseUrl(): string {
  const user: string = encodeURIComponent(process.env.DB_USER ?? "auth_service");
  const password: string = encodeURIComponent(process.env.DB_PASSWORD ?? "");
  const host: string = process.env.DB_HOST ?? "localhost";
  const port: string = process.env.DB_PORT ?? "5432";
  const name: string = process.env.DB_NAME ?? "auth_db";
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl(),
  },
});
