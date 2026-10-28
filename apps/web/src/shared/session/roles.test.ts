import { describe, expect, it } from "vitest";

import { outranks } from "./roles";

describe("outranks", () => {
  it("only lets a role act on the roles below it", () => {
    expect(outranks("root", "admin")).toBe(true);
    expect(outranks("root", "user")).toBe(true);
    expect(outranks("admin", "user")).toBe(true);
  });

  it("never lets a role act on its own role or a higher one", () => {
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("admin", "root")).toBe(false);
    expect(outranks("user", "user")).toBe(false);
    expect(outranks("root", "root")).toBe(false);
  });
});
