import { afterEach, describe, expect, it, vi } from "vitest";

import { getAccessToken } from "@shared/session/token-store";
import { subscribeSession } from "@shared/session/session-events";
import type { SessionResponse } from "@shared/session/types";

import { refreshSession, sessionHttp } from "./http";

/**
 * Session returned by a successful refresh.
 */
const SESSION: SessionResponse = {
  access_token: "new-access-token",
  token_type: "Bearer",
  expires_in: 900,
  expires_at: new Date(Date.now() + 900_000).toISOString(),
  session_expires_at: new Date(Date.now() + 43_200_000).toISOString(),
  user: {
    id: "user-id",
    email: "operario@taller.com",
    full_name: "Ana Torres",
    role: "user",
    is_active: true,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
    permissions: ["clients:read"],
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("refreshSession", () => {
  it("shares one request between concurrent callers, so the cookie is rotated only once", async () => {
    const post = vi.spyOn(sessionHttp, "post").mockResolvedValue({ data: SESSION });
    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith("/refresh");
    expect(results.every((result) => result.access_token === "new-access-token")).toBe(true);
  });

  it("keeps the access token in memory and tells the listeners", async () => {
    vi.spyOn(sessionHttp, "post").mockResolvedValue({ data: SESSION });
    const renewed = vi.fn();
    const unsubscribe = subscribeSession({ renewed });
    await refreshSession();
    unsubscribe();
    expect(getAccessToken()).toBe("new-access-token");
    expect(renewed).toHaveBeenCalledWith(SESSION.user);
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0);
  });

  it("lets a new refresh run after the previous one finished", async () => {
    const post = vi.spyOn(sessionHttp, "post").mockResolvedValue({ data: SESSION });
    await refreshSession();
    await refreshSession();
    expect(post).toHaveBeenCalledTimes(2);
  });
});
