/**
 * @file Connection to the service database through Prisma and the `pg` driver adapter.
 */

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client";

/**
 * Options of the connection pool.
 */
export interface DatabaseOptions {
  url: string;
  poolSize: number;
}

/**
 * Owns the Prisma client of the service and reports whether the database answers.
 */
export class Database {
  readonly client: PrismaClient;

  /**
   * @param options - Connection URL and pool size.
   */
  constructor(options: DatabaseOptions) {
    const adapter: PrismaPg = new PrismaPg({ connectionString: options.url, max: options.poolSize });
    this.client = new PrismaClient({ adapter });
  }

  /**
   * Checks that the database answers a trivial query.
   *
   * @returns True when the database answers.
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Closes every connection of the pool.
   */
  async dispose(): Promise<void> {
    await this.client.$disconnect();
  }
}
