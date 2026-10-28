import type { ReactNode } from "react";
import { vi } from "vitest";

import { SessionContext, type SessionContextValue } from "@shared/session/session-context";
import type { Permission, Profile } from "@shared/session/types";

/**
 * Builds a signed in account for tests.
 *
 * @param overrides - Fields that replace the defaults.
 * @returns The account.
 */
export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    email: "operario@taller.com",
    full_name: "Ana Torres",
    role: "user",
    is_active: true,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
    permissions: ["clients:read", "engines:read", "repair_orders:read", "repair_orders:write"],
    ...overrides,
  };
}

/**
 * Builds a session value for tests, with spies for login and logout.
 *
 * @param overrides - Values that replace the defaults.
 * @returns The session value.
 */
export function makeSession(overrides: Partial<SessionContextValue> = {}): SessionContextValue {
  const profile: Profile | null = overrides.profile === undefined ? makeProfile() : overrides.profile;
  return {
    status: profile ? "authenticated" : "anonymous",
    profile,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    can: (permission: Permission) => profile?.role === "root" || (profile?.permissions.includes(permission) ?? false),
    ...overrides,
  };
}

/**
 * Props of {@link TestSession}.
 */
interface TestSessionProps {
  /** Session to provide. */
  value: SessionContextValue;
  /** Content under test. */
  children: ReactNode;
}

/**
 * Provides a fixed session to the content under test.
 *
 * @param props - Session and content.
 * @returns The provider.
 */
export function TestSession({ value, children }: TestSessionProps) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
