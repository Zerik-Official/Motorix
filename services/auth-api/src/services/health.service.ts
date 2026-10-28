/**
 * @file Health check of the service and its dependencies.
 */

/**
 * State of the service or one of its dependencies.
 */
export type ComponentStatus = "ok" | "unavailable";

/**
 * Result of the health check.
 */
export interface HealthReport {
  status: ComponentStatus;
  database: ComponentStatus;
}

/**
 * Dependency that can report whether it answers.
 */
export interface Pingable {
  /**
   * @returns True when the dependency answers.
   */
  ping(): Promise<boolean>;
}

/**
 * Reports the state of the service from the state of its dependencies.
 */
export class HealthService {
  /**
   * @param database - Database of the service.
   */
  constructor(private readonly database: Pingable) {}

  /**
   * Checks every dependency.
   *
   * @returns `ok` when every dependency answers, `unavailable` otherwise.
   */
  async check(): Promise<HealthReport> {
    const database: ComponentStatus = (await this.database.ping()) ? "ok" : "unavailable";
    return { status: database, database };
  }
}
