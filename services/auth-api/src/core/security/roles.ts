/**
 * @file Authorization roles and their strict hierarchy: `root` > `admin` > `user`.
 */

/**
 * Every role, from the most to the least privileged.
 */
export const ROLES = ["root", "admin", "user"] as const;

/**
 * Authorization role of an account.
 */
export type Role = (typeof ROLES)[number];

const ROLE_RANK: Record<Role, number> = {
  root: 3,
  admin: 2,
  user: 1,
};

/**
 * Tells whether a role sits strictly above another one.
 *
 * @param actor - Role of the account acting.
 * @param target - Role being acted upon.
 * @returns True when `actor` outranks `target`.
 */
export function outranks(actor: Role, target: Role): boolean {
  return ROLE_RANK[actor] > ROLE_RANK[target];
}

/**
 * Tells whether a text is a known role.
 *
 * @param value - Text to check.
 * @returns True for `root`, `admin` or `user`.
 */
export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
