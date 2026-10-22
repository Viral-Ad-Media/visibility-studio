import { provisionNewClerkUser } from "./clerk-provisioning";
import { cache } from "react";
import { cookies } from "next/headers";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getAuthConfig } from "./auth-config";
import { supabaseServerClient } from "./supabase-server";
import { serviceDb } from "./db";

export type AuthenticatedUser = {
  id: string;
  provider: "clerk" | "supabase";
  providerUserId: string;
  email: string | null;
  emailConfirmedAt: string | null;
  sessionId?: string;
};

export async function resolveMappedIdentity(provider: "clerk" | "supabase", issuer: string, subject: string) {
  const row = await serviceDb.prepare(
    `SELECT u.id, u.email, u.email_confirmed_at, u.disabled_at
     FROM vis_private.identity_map m JOIN public.vis_users u ON u.id = m.user_id
     WHERE m.provider = ? AND m.issuer = ? AND m.subject = ?`,
  ).get(provider, issuer, subject);
  if (!row || row.disabled_at) return null;
  return {
    id: String(row.id), email: row.email ? String(row.email) : null,
    emailConfirmedAt: row.email_confirmed_at ? new Date(row.email_confirmed_at).toISOString() : null,
  };
}

export const getAuthenticatedUser = cache(async (): Promise<AuthenticatedUser | null> => {
  const config = getAuthConfig();
  if (config.provider === "supabase") {
    const { data, error } = await (await supabaseServerClient()).auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, provider: "supabase", providerUserId: data.user.id,
      email: data.user.email ?? null, emailConfirmedAt: data.user.email_confirmed_at ?? null };
  }
  // Only Clerk-verified sessions are accepted. Legacy application-signed cookies
  // are intentionally ignored. Check live status to honor revocation immediately.
  const { userId, sessionId } = await auth();
  if (!userId || !sessionId) return null;
  const client = await clerkClient();
  const session = await client.sessions.getSession(sessionId);
  if (session.status !== "active" || session.userId !== userId) return null;
  const clerkUser = await client.users.getUser(userId);
  if (clerkUser.banned || clerkUser.locked) return null;
  const primary = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId);
  const email = primary?.emailAddress.toLowerCase() ?? null;
  const verifiedAt = primary?.verification?.status === "verified" ? new Date().toISOString() : null;
  await provisionNewClerkUser(serviceDb, {
    subject: userId, issuer: config.issuer, externalId: clerkUser.externalId,
    email, verifiedAt,
  });
  const mapped = await resolveMappedIdentity("clerk", config.issuer, userId);
  if (!mapped) return null;
  await serviceDb.prepare(
    `UPDATE public.vis_users SET email = ?, email_confirmed_at = ? WHERE id = ? AND disabled_at IS NULL`,
  ).run(email, verifiedAt, mapped.id);
  return { ...mapped, email, emailConfirmedAt: verifiedAt, provider: "clerk", providerUserId: userId, sessionId };
});

export async function clerkSignOutCurrentUser(): Promise<void> {
  const { sessionId } = await auth();
  if (sessionId) await (await clerkClient()).sessions.revokeSession(sessionId);
  const jar = await cookies();
  jar.delete("vis_clerk_session");
  jar.delete("__session");
}

// The identifier comes only from deployment configuration, never request input.
export function userDirectoryTable(): "public.vis_users" | "auth.users" {
  return getAuthConfig().provider === "clerk" ? "public.vis_users" : "auth.users";
}
