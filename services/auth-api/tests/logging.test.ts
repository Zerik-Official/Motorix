import { describe, expect, test } from "bun:test";

import { ConsoleLogger, parseLevel, SuppressionRules } from "../src/core/logging";

describe("parseLevel", () => {
  test("is case insensitive and falls back to INFO", () => {
    expect(parseLevel(" debug ")).toBe("DEBUG");
    expect(parseLevel("unknown")).toBe("INFO");
  });
});

describe("SuppressionRules", () => {
  test("parses whole levels and level/verbosity pairs, ignoring malformed entries", () => {
    const rules: SuppressionRules = SuppressionRules.parse("DEBUG:3, success, nope, INFO:x");
    expect(rules.suppresses("SUCCESS", 1)).toBe(true);
    expect(rules.suppresses("DEBUG", 3)).toBe(true);
    expect(rules.suppresses("DEBUG", 2)).toBe(false);
    expect(rules.suppresses("INFO", 1)).toBe(false);
  });
});

describe("ConsoleLogger", () => {
  test("filters by level, verbosity and suppression", () => {
    const logger: ConsoleLogger = new ConsoleLogger();
    logger.configure("INFO", 2, "WARNING:2");
    expect(logger.isEnabled("DEBUG")).toBe(false);
    expect(logger.isEnabled("INFO", 2)).toBe(true);
    expect(logger.isEnabled("INFO", 3)).toBe(false);
    expect(logger.isEnabled("WARNING", 2)).toBe(false);
    expect(logger.isEnabled("WARNING", 1)).toBe(true);
  });
});
