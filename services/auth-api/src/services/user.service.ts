/**
 * @file Account management with the role hierarchy: an account only manages accounts strictly below it.
 */

import { BusinessRuleError, NotFoundError, PermissionDeniedError } from "../core/errors";
import type { Caller } from "../core/security/caller";
import type { PasswordHasher } from "../core/security/password-hasher";
import { outranks, type Role } from "../core/security/roles";
import type { UserChanges, UserListResult, UserRecord, UserRepository } from "../repositories/user.repository";
import type {
  PasswordChangeInput,
  UserCreateInput,
  UserListQueryInput,
  UserUpdateInput,
} from "../schemas/user.schemas";

/**
 * Creates, reads, updates and deactivates accounts.
 */
export class UserService {
  /**
   * @param users - Account storage.
   * @param hasher - Password hasher.
   * @param maxPageSize - Upper limit of the page size of a listing.
   */
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly maxPageSize: number,
  ) {}

  /**
   * Checks that the caller may manage an account of a given role.
   *
   * @param caller - Account making the change.
   * @param targetRole - Role of the account being managed, or the role it is being given.
   * @throws PermissionDeniedError When the caller lacks `users:manage` or does not outrank `targetRole`.
   */
  private assertCanManage(caller: Caller, targetRole: Role): void {
    if (!caller.permissions.includes("users:manage")) {
      throw new PermissionDeniedError("Managing users requires 'users:manage'");
    }
    if (!outranks(caller.role, targetRole)) {
      throw new PermissionDeniedError(`A '${caller.role}' cannot manage '${targetRole}' accounts`);
    }
  }

  /**
   * Loads an account.
   *
   * @param id - Identifier of the account.
   * @returns The account.
   * @throws NotFoundError When it does not exist.
   */
  private async find(id: string): Promise<UserRecord> {
    const user: UserRecord | null = await this.users.findById(id);
    if (user === null) {
      throw new NotFoundError("User not found", { id });
    }
    return user;
  }

  /**
   * Loads the caller's own account.
   *
   * @param caller - Authenticated account.
   * @returns The account.
   */
  getOwn(caller: Caller): Promise<UserRecord> {
    return this.find(caller.id);
  }

  /**
   * Loads an account: anyone can read their own, `users:manage` is required for the rest.
   *
   * @param caller - Authenticated account.
   * @param id - Identifier of the account.
   * @returns The account.
   * @throws PermissionDeniedError When reading someone else's account without `users:manage`.
   */
  async get(caller: Caller, id: string): Promise<UserRecord> {
    if (caller.id !== id && !caller.permissions.includes("users:manage")) {
      throw new PermissionDeniedError("Reading other users requires 'users:manage'");
    }
    return this.find(id);
  }

  /**
   * Lists accounts.
   *
   * @param query - Filters and page; the page size is capped by `MAX_PAGE_SIZE`.
   * @returns The page and the total matching the filters.
   */
  async list(query: UserListQueryInput): Promise<UserListResult & { limit: number; offset: number }> {
    const limit: number = Math.min(query.limit, this.maxPageSize);
    const result: UserListResult = await this.users.list({
      offset: query.offset,
      limit,
      search: query.search,
      role: query.role,
      isActive: query.is_active,
    });
    return { ...result, limit, offset: query.offset };
  }

  /**
   * Registers an account with a role below the caller's.
   *
   * @param caller - Account making the change.
   * @param data - Fields of the new account.
   * @returns The created account.
   * @throws PermissionDeniedError When the caller cannot assign that role.
   * @throws ConflictError When the email is already used.
   */
  async create(caller: Caller, data: UserCreateInput): Promise<UserRecord> {
    this.assertCanManage(caller, data.role);
    return this.users.create({
      email: data.email,
      fullName: data.full_name,
      passwordHash: await this.hasher.hash(data.password),
      role: data.role,
    });
  }

  /**
   * Replaces the editable fields of an account; the caller must outrank both its current and its new role.
   *
   * @param caller - Account making the change.
   * @param id - Identifier of the account.
   * @param data - New values; `password` resets the password when sent.
   * @returns The updated account.
   * @throws PermissionDeniedError When the caller cannot manage the account or assign the new role.
   * @throws ConflictError When the new email is already used.
   */
  async update(caller: Caller, id: string, data: UserUpdateInput): Promise<UserRecord> {
    const user: UserRecord = await this.find(id);
    this.assertCanManage(caller, user.role);
    this.assertCanManage(caller, data.role);
    const changes: UserChanges = {
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      isActive: data.is_active,
    };
    if (data.password !== undefined) {
      changes.passwordHash = await this.hasher.hash(data.password);
    }
    return this.users.update(id, changes);
  }

  /**
   * Deactivates an account without deleting it; it can no longer authenticate.
   *
   * @param caller - Account making the change.
   * @param id - Identifier of the account.
   * @returns The deactivated account.
   * @throws PermissionDeniedError When the caller cannot manage the account.
   */
  async deactivate(caller: Caller, id: string): Promise<UserRecord> {
    const user: UserRecord = await this.find(id);
    this.assertCanManage(caller, user.role);
    if (!user.isActive) {
      return user;
    }
    return this.users.update(id, { isActive: false });
  }

  /**
   * Changes the caller's own password after checking the current one; `root` changes it in the environment.
   *
   * @param caller - Authenticated account.
   * @param data - Current and new password.
   * @throws BusinessRuleError For `root`, when the current password is wrong, or when the new one equals it.
   */
  async changeOwnPassword(caller: Caller, data: PasswordChangeInput): Promise<void> {
    if (caller.role === "root") {
      throw new BusinessRuleError("The password of root is managed through ROOT_PASSWORD");
    }
    const user: UserRecord = await this.find(caller.id);
    if (!(await this.hasher.verify(data.current_password, user.passwordHash))) {
      throw new BusinessRuleError("The current password is not correct", { field: "current_password" });
    }
    if (data.current_password === data.new_password) {
      throw new BusinessRuleError("The new password must be different from the current one");
    }
    await this.users.update(user.id, { passwordHash: await this.hasher.hash(data.new_password) });
  }
}
