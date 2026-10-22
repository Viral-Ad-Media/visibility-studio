import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), getSession: vi.fn(), getUser: vi.fn(), revokeSession: vi.fn(),
  prepare: vi.fn(), provision: vi.fn(),
}));
vi.mock("react", () => ({ cache: (fn: any) => fn }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: vi.fn() }) }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: async () => ({ sessions: { getSession: mocks.getSession, revokeSession: mocks.revokeSession }, users: { getUser: mocks.getUser } }),
}));
vi.mock("../lib/auth-config", () => ({ getAuthConfig: () => ({ provider: "clerk", issuer: "https://clerk.example.com" }) }));
vi.mock("../lib/db", () => ({ serviceDb: { prepare: mocks.prepare } }));
vi.mock("../lib/clerk-provisioning", () => ({ provisionNewClerkUser: mocks.provision }));
import { getAuthenticatedUser, clerkSignOutCurrentUser } from "../lib/auth";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_a", sessionId: "sess_a" });
  mocks.getSession.mockResolvedValue({ status: "active", userId: "user_a" });
  mocks.getUser.mockResolvedValue({ id: "user_a", emailAddresses: [] });
  mocks.prepare.mockReturnValue({ get: async () => ({ id: "stable-uuid", email: "old@example.invalid", email_confirmed_at: new Date() }), run: vi.fn() });
});
it.each(["revoked", "ended", "expired"])("denies %s sessions before database access", async status => {
  mocks.getSession.mockResolvedValue({ status, userId: "user_a" });
  expect(await getAuthenticatedUser()).toBeNull();
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it("rejects a session belonging to a different subject", async () => {
  mocks.getSession.mockResolvedValue({ status: "active", userId: "user_b" });
  expect(await getAuthenticatedUser()).toBeNull();
});
it("rejects banned users and disabled application identities", async () => {
  mocks.getUser.mockResolvedValueOnce({ banned: true });
  expect(await getAuthenticatedUser()).toBeNull();
  mocks.prepare.mockReturnValue({ get: async () => ({ id: "stable-uuid", disabled_at: new Date() }) });
  expect(await getAuthenticatedUser()).toBeNull();
});
it("preserves mapped IDs and clears stale email verification", async () => {
  const user = await getAuthenticatedUser();
  expect(user?.id).toBe("stable-uuid");
  expect(user?.emailConfirmedAt).toBeNull();
});
it("revokes the real Clerk session on logout", async () => {
  await clerkSignOutCurrentUser();
  expect(mocks.revokeSession).toHaveBeenCalledWith("sess_a");
});
