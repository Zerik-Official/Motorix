import { beforeEach, describe, expect, test } from "bun:test";

import { ConflictError } from "../src/core/errors";
import { PERMISSIONS } from "../src/core/security/permissions";
import { PasswordHasher } from "../src/core/security/password-hasher";
import type { UserRecord } from "../src/repositories/user.repository";
import { PermissionService } from "../src/services/permission.service";
import { RootAccountService, type RootCredentials } from "../src/services/root-account.service";
import { InMemoryRolePermissionRepository, InMemoryUserRepository } from "./support/fakes";

const hasher: PasswordHasher = new PasswordHasher(1024, 1);
const CREDENTIALS: RootCredentials = { email: "Root@Motorix.Local", password: "a-long-root-password", fullName: "Root" };

describe("PasswordHasher", () => {
  test("hashes with Argon2id and verifies only the right password", async () => {
    const hash: string = await hasher.hash("secret-password");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await hasher.verify("secret-password", hash)).toBe(true);
    expect(await hasher.verify("wrong-password", hash)).toBe(false);
    expect(await hasher.verify("secret-password", "not-a-hash")).toBe(false);
  });
});

describe("PermissionService", () => {
  test("gives root every permission without reading storage", async () => {
    const service: PermissionService = new PermissionService(new InMemoryRolePermissionRepository());
    expect(await service.resolve("root")).toEqual([...PERMISSIONS]);
  });

  test("returns the stored permissions of other roles, ignoring unknown ones", async () => {
    const service: PermissionService = new PermissionService(
      new InMemoryRolePermissionRepository({ user: ["repair_orders:write", "clients:read", "legacy:thing"] }),
    );
    expect(await service.resolve("user")).toEqual(["clients:read", "repair_orders:write"]);
    expect(await service.resolve("admin")).toEqual([]);
  });
});

describe("RootAccountService", () => {
  let users: InMemoryUserRepository;
  let service: RootAccountService;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    service = new RootAccountService(users, hasher);
  });

  test("creates root on the first start with a hashed password", async () => {
    expect(await service.ensureRoot(CREDENTIALS)).toBe("created");
    const root: UserRecord | null = await users.findRoot();
    expect(root?.email).toBe("root@motorix.local");
    expect(root?.passwordHash).not.toBe(CREDENTIALS.password);
    expect(await hasher.verify(CREDENTIALS.password, root?.passwordHash ?? "")).toBe(true);
  });

  test("leaves root unchanged when the environment did not change", async () => {
    await service.ensureRoot(CREDENTIALS);
    expect(await service.ensureRoot(CREDENTIALS)).toBe("unchanged");
  });

  test("applies new credentials and reactivates root", async () => {
    await service.ensureRoot(CREDENTIALS);
    const root: UserRecord = (await users.findRoot()) as UserRecord;
    await users.update(root.id, { isActive: false });

    const result = await service.ensureRoot({ ...CREDENTIALS, email: "admin@motorix.local", password: "another-long-password" });

    const updated: UserRecord = (await users.findRoot()) as UserRecord;
    expect(result).toBe("updated");
    expect(updated.email).toBe("admin@motorix.local");
    expect(updated.isActive).toBe(true);
    expect(await hasher.verify("another-long-password", updated.passwordHash)).toBe(true);
    expect(users.users.size).toBe(1);
  });

  test("refuses an email already used by another account", async () => {
    await users.create({ email: "root@motorix.local", fullName: "Someone", passwordHash: "x", role: "admin" });
    await expect(service.ensureRoot(CREDENTIALS)).rejects.toThrow(ConflictError);
  });
});
