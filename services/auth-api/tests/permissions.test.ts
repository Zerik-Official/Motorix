import { describe, expect, test } from "bun:test";

import { PermissionDeniedError, ValidationError } from "../src/core/errors";
import {
  assertCanChangePermission,
  normalizePermissions,
  PERMISSIONS,
  type PermissionActor,
} from "../src/core/security/permissions";
import { outranks } from "../src/core/security/roles";

const ROOT: PermissionActor = { role: "root", permissions: PERMISSIONS };
const ADMIN: PermissionActor = { role: "admin", permissions: PERMISSIONS.filter((p) => p !== "clients:write") };
const USER: PermissionActor = { role: "user", permissions: ["clients:read", "permissions:manage"] };

describe("outranks", () => {
  test("follows root > admin > user strictly", () => {
    expect(outranks("root", "admin")).toBe(true);
    expect(outranks("admin", "user")).toBe(true);
    expect(outranks("admin", "admin")).toBe(false);
    expect(outranks("user", "admin")).toBe(false);
  });
});

describe("normalizePermissions", () => {
  test("drops unknown names and duplicates and keeps catalog order", () => {
    expect(normalizePermissions(["engines:read", "bogus", "clients:read", "engines:read"])).toEqual([
      "clients:read",
      "engines:read",
    ]);
  });
});

describe("assertCanChangePermission", () => {
  test("lets root change admin and user", () => {
    expect(() => assertCanChangePermission(ROOT, "admin", "users:manage")).not.toThrow();
    expect(() => assertCanChangePermission(ROOT, "user", "clients:write")).not.toThrow();
  });

  test("lets admin change user with a permission it holds", () => {
    expect(() => assertCanChangePermission(ADMIN, "user", "engines:write")).not.toThrow();
  });

  test("forbids changing the own role, a higher one or root", () => {
    expect(() => assertCanChangePermission(ADMIN, "admin", "engines:write")).toThrow(PermissionDeniedError);
    expect(() => assertCanChangePermission(ADMIN, "root", "engines:write")).toThrow(PermissionDeniedError);
    expect(() => assertCanChangePermission(ROOT, "root", "engines:write")).toThrow(PermissionDeniedError);
  });

  test("forbids granting a permission the actor does not hold", () => {
    expect(() => assertCanChangePermission(ADMIN, "user", "clients:write")).toThrow(/you hold/);
  });

  test("requires permissions:manage", () => {
    const withoutManage: PermissionActor = { role: "admin", permissions: ["clients:read"] };
    expect(() => assertCanChangePermission(withoutManage, "user", "clients:read")).toThrow(/permissions:manage/);
  });

  test("never lets a user change anyone, even holding permissions:manage", () => {
    expect(() => assertCanChangePermission(USER, "user", "clients:read")).toThrow(PermissionDeniedError);
  });

  test("rejects permissions outside the catalog", () => {
    expect(() => assertCanChangePermission(ROOT, "user", "billing:write")).toThrow(ValidationError);
  });
});
