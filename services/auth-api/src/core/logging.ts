/**
 * @file Colored console logging with numeric verbosity, copied to the log file of the service.
 *
 * Every line has a level and a verbosity (1 by default, higher means more detail). A line is
 * printed when its level reaches `LOG_LEVEL`, its verbosity does not exceed `LOG_VERBOSITY` and it
 * is not listed in `LOG_SUPPRESS`. `LOG_SUPPRESS` is a comma separated list where `SUCCESS`
 * silences a whole level and `DEBUG:3` silences only that verbosity of the level.
 */

import { writeLine } from "./log-files";

/**
 * Severity of a log line, ordered from least to most severe.
 */
export const LogLevel = {
  DEBUG: 10,
  INFO: 20,
  SUCCESS: 25,
  WARNING: 30,
  ERROR: 40,
  CRITICAL: 50,
} as const;

/**
 * Name of a log level.
 */
export type LogLevelName = keyof typeof LogLevel;

const RESET: string = "\x1b[0m";
const DIM: string = "\x1b[2m";

const LEVEL_COLORS: Record<LogLevelName, string> = {
  DEBUG: "\x1b[35m",
  INFO: "\x1b[36m",
  SUCCESS: "\x1b[32m",
  WARNING: "\x1b[33m",
  ERROR: "\x1b[31m",
  CRITICAL: "\x1b[1;91m",
};

/**
 * Tells whether a text is the name of a log level.
 *
 * @param name - Text to check.
 * @returns True for a known level name.
 */
function isLevelName(name: string): name is LogLevelName {
  return Object.hasOwn(LogLevel, name);
}

/**
 * Converts a level name to its level.
 *
 * @param name - Level name, case insensitive.
 * @returns The matching level, or INFO for an unknown name.
 */
export function parseLevel(name: string): LogLevelName {
  const normalized: string = name.trim().toUpperCase();
  return isLevelName(normalized) ? normalized : "INFO";
}

/**
 * Formats a date as `YYYY-MM-DD HH:MM:SS` in local time.
 *
 * @param date - Date to format.
 * @returns The formatted date.
 */
function formatTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Levels and level/verbosity pairs that are never printed.
 */
export class SuppressionRules {
  /**
   * @param levels - Levels silenced entirely.
   * @param pairs - Level/verbosity pairs silenced, encoded as `LEVEL:verbosity`.
   */
  constructor(
    readonly levels: ReadonlySet<LogLevelName> = new Set(),
    readonly pairs: ReadonlySet<string> = new Set(),
  ) {}

  /**
   * Builds the rules from the `LOG_SUPPRESS` syntax, ignoring malformed entries.
   *
   * @param raw - Comma separated entries such as `DEBUG:3,SUCCESS`.
   * @returns The parsed rules.
   */
  static parse(raw: string): SuppressionRules {
    const levels: Set<LogLevelName> = new Set();
    const pairs: Set<string> = new Set();
    for (const entry of raw.split(",")) {
      const [name = "", verbosity] = entry.trim().split(":", 2);
      const normalized: string = name.trim().toUpperCase();
      if (!isLevelName(normalized)) {
        continue;
      }
      if (verbosity === undefined || verbosity.trim() === "") {
        levels.add(normalized);
      } else if (/^\d+$/.test(verbosity.trim())) {
        pairs.add(`${normalized}:${Number(verbosity.trim())}`);
      }
    }
    return new SuppressionRules(levels, pairs);
  }

  /**
   * Tells whether a line is silenced.
   *
   * @param level - Level of the line.
   * @param verbosity - Verbosity of the line.
   * @returns True when the level or the exact level/verbosity pair is suppressed.
   */
  suppresses(level: LogLevelName, verbosity: number): boolean {
    return this.levels.has(level) || this.pairs.has(`${level}:${verbosity}`);
  }
}

/**
 * Prints filtered, timestamped and color-coded lines and copies them to the log file.
 */
export class ConsoleLogger {
  private threshold: number = LogLevel.INFO;
  private maxVerbosity: number = 1;
  private rules: SuppressionRules = new SuppressionRules();

  /**
   * Applies the filters of the service.
   *
   * @param level - Minimum level printed.
   * @param verbosity - Maximum verbosity printed.
   * @param suppress - Entries in the `LOG_SUPPRESS` syntax.
   */
  configure(level: string, verbosity: number, suppress: string): void {
    this.threshold = LogLevel[parseLevel(level)];
    this.maxVerbosity = Math.max(1, verbosity);
    this.rules = SuppressionRules.parse(suppress);
  }

  /**
   * Tells whether a line passes the filters.
   *
   * @param level - Level of the line.
   * @param verbosity - Verbosity of the line.
   * @returns True when the line would be printed.
   */
  isEnabled(level: LogLevelName, verbosity: number = 1): boolean {
    return (
      LogLevel[level] >= this.threshold &&
      verbosity <= this.maxVerbosity &&
      !this.rules.suppresses(level, verbosity)
    );
  }

  /**
   * Prints a line to stdout and appends it, without colors, to the log file of the service.
   *
   * @param level - Level of the line (DEBUG, INFO, SUCCESS, WARNING, ERROR or CRITICAL).
   * @param message - Text to print.
   * @param verbosity - Detail of the line, 1 for the most relevant.
   */
  log(level: LogLevelName | string, message: string, verbosity: number = 1): void {
    const resolved: LogLevelName = parseLevel(level);
    if (!this.isEnabled(resolved, verbosity)) {
      return;
    }
    const timestamp: string = formatTimestamp(new Date());
    const label: string = verbosity === 1 ? resolved : `${resolved}:${verbosity}`;
    const color: string = LEVEL_COLORS[resolved];
    process.stdout.write(`${DIM}${timestamp}${RESET} [${color}${label}${RESET}] ${message}\n`);
    writeLine(`${timestamp} [${label}] ${message}`);
  }
}

/**
 * Logger shared by the whole service.
 */
export const logger: ConsoleLogger = new ConsoleLogger();

/**
 * Applies the filters of the service to the shared logger.
 *
 * @param level - Minimum level printed.
 * @param verbosity - Maximum verbosity printed.
 * @param suppress - Entries in the `LOG_SUPPRESS` syntax.
 */
export function configureLogging(level: string, verbosity: number, suppress: string): void {
  logger.configure(level, verbosity, suppress);
}

/**
 * Prints a line through the shared logger.
 *
 * @param level - Level of the line.
 * @param message - Text to print.
 * @param verbosity - Detail of the line, 1 for the most relevant.
 */
export function log(level: LogLevelName | string, message: string, verbosity: number = 1): void {
  logger.log(level, message, verbosity);
}
