import crypto from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import { cache } from "react";
import { cookies } from "next/headers";
import { getAuthConfig, type ClerkAuthConfig } from "./auth-config";
import {
  CLERK_DEFAULT_SESSION_SECONDS,
  CLERK_SESSION_COOKIE,
  signClerkSessionToken,
  verifyClerkSessionToken,
} from "./clerk-session";
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

const fallbackResolver = new dns.promises.Resolver();
fallbackResolver.setServers(["1.1.1.1", "8.8.8.8"]);

async function resolveHostname(hostname: string): Promise<string> {
  try {
    const res = await dns.promises.lookup(hostname);
    return res.address;
  } catch {
    const ips = await fallbackResolver.resolve4(hostname);
    if (ips.length > 0) return ips[0];
    throw new Error(`DNS lookup failed for ${hostname}`);
  }
}

async function clerkBackendRequest<T = any>(
  secretKey: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  apiPath: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: T }> {
  const ip = await resolveHostname("api.clerk.com");
  const payload = body ? JSON.stringify(body) : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: ip,
        servername: "api.clerk.com",
        port: 443,
        method,
        path: apiPath,
        timeout: 15000,
        headers: {
          Host: "api.clerk.com",
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
          "User-Agent": "visibility-studio/1.0",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let parsed: any = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode ?? 500, data: parsed as T });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("Clerk API request timed out"));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

let cachedJwks: { issuer: string; keys: crypto.JsonWebKey[]; fetchedAt: number } | undefined;

async function getClerkJwks(config: ClerkAuthConfig): Promise<crypto.JsonWebKey[]> {
  const now = Date.now();
  if (
    cachedJwks &&
    cachedJwks.issuer === config.issuer &&
    now - cachedJwks.fetchedAt < 5 * 60 * 1000
  ) {
    return cachedJwks.keys;
  }
  const res = await clerkBackendRequest<{ keys?: crypto.JsonWebKey[] }>(
    config.secretKey,
    "GET",
    "/v1/jwks",
  );
  const keys = Array.isArray(res.data?.keys) ? res.data.keys : [];
  cachedJwks = { issuer: config.issuer, keys, fetchedAt: now };
  return keys;
}

function extractClerkPrimaryEmail(clerkUser: any): {
  email: string | null;
  verifiedAt: string | null;
} {
  const addresses: any[] = Array.isArray(clerkUser?.email_addresses)
    ? clerkUser.email_addresses
    : [];
  const primary =
    addresses.find((a) => a.id === clerkUser?.primary_email_address_id) ??
    addresses[0];
  if (!primary || typeof primary.email_address !== "string") {
    return { email: null, verifiedAt: null };
  }
  const isVerified = primary.verification?.status === "verified";
  return {
    email: primary.email_address.toLowerCase(),
    verifiedAt: isVerified ? new Date().toISOString() : null,
  };
}

export async function resolveMappedIdentity(
  provider: "clerk" | "supabase",
  issuer: string,
  subject: string,
): Promise<{
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
} | null> {
  const row = await serviceDb
    .prepare(
      `SELECT u.id, u.email, u.email_confirmed_at, u.disabled_at
       FROM vis_private.identity_map m
       JOIN public.vis_users u ON u.id = m.user_id
       WHERE m.provider = ? AND m.issuer = ? AND m.subject = ?`,
    )
    .get(provider, issuer, subject);

  if (!row || row.disabled_at) {
    return null;
  }
  return {
    id: String(row.id),
    email: row.email ? String(row.email) : null,
    emailConfirmedAt: row.email_confirmed_at
      ? new Date(row.email_confirmed_at).toISOString()
      : null,
  };
}

async function resolveCurrentUserUncached(): Promise<AuthenticatedUser | null> {
  const config = getAuthConfig();
  if (config.provider === "supabase") {
    const { data, error } = await (await supabaseServerClient()).auth.getUser();
    if (error || !data.user) return null;
    return {
      id: data.user.id,
      provider: "supabase",
      providerUserId: data.user.id,
      email: data.user.email ?? null,
      emailConfirmedAt: data.user.email_confirmed_at ?? null,
    };
  }

  const cookieStore = await cookies();
  const token =
    cookieStore.get(CLERK_SESSION_COOKIE)?.value ||
    cookieStore.get("__session")?.value;
  if (!token) return null;

  let jwksKeys: crypto.JsonWebKey[] | undefined;
  try {
    const header = JSON.parse(
      Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8"),
    );
    if (header?.alg === "RS256") {
      jwksKeys = await getClerkJwks(config);
    }
  } catch {
    return null;
  }

  const verified = verifyClerkSessionToken(token, {
    issuer: config.issuer,
    secretKey: config.secretKey,
    jwksKeys,
  });
  if (!verified) return null;

  const mapped = await resolveMappedIdentity(
    "clerk",
    verified.issuer,
    verified.subject,
  );
  if (!mapped) return null;

  return {
    id: mapped.id,
    provider: "clerk",
    providerUserId: verified.subject,
    email: mapped.email,
    emailConfirmedAt: mapped.emailConfirmedAt,
    sessionId: verified.sessionId,
  };
}

let cachedGetAuthenticatedUser:
  | (() => Promise<AuthenticatedUser | null>)
  | undefined;

export function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!cachedGetAuthenticatedUser) {
    cachedGetAuthenticatedUser = cache(resolveCurrentUserUncached);
  }
  return cachedGetAuthenticatedUser();
}

async function setClerkSessionCookie(config: ClerkAuthConfig, subject: string) {
  const token = signClerkSessionToken({
    subject,
    issuer: config.issuer,
    secretKey: config.secretKey,
    expiresInSeconds: CLERK_DEFAULT_SESSION_SECONDS,
  });
  const cookieStore = await cookies();
  cookieStore.set(CLERK_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CLERK_DEFAULT_SESSION_SECONDS,
  });
}

export async function clerkSignInWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const config = getAuthConfig();
  if (config.provider !== "clerk") {
    return { error: "Clerk authentication is not active" };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { error: "Invalid login credentials" };
  }

  const listRes = await clerkBackendRequest<any[]>(
    config.secretKey,
    "GET",
    `/v1/users?email_address=${encodeURIComponent(normalizedEmail)}`,
  );
  if (
    listRes.status !== 200 ||
    !Array.isArray(listRes.data) ||
    listRes.data.length === 0
  ) {
    return { error: "Invalid login credentials" };
  }

  const clerkUser = listRes.data[0];
  if (!clerkUser?.id || clerkUser.banned || clerkUser.locked) {
    return { error: "Invalid login credentials" };
  }

  const verifyRes = await clerkBackendRequest<{ verified?: boolean }>(
    config.secretKey,
    "POST",
    `/v1/users/${encodeURIComponent(clerkUser.id)}/verify_password`,
    { password },
  );
  if (verifyRes.status !== 200 || !verifyRes.data?.verified) {
    return { error: "Invalid login credentials" };
  }

  // Must resolve via vis_private.identity_map — never auto-link by email alone.
  const mapped = await resolveMappedIdentity(
    "clerk",
    config.issuer,
    String(clerkUser.id),
  );
  if (!mapped) {
    return { error: "Account identity is not provisioned for this workspace" };
  }

  const { email: primaryEmail, verifiedAt } =
    extractClerkPrimaryEmail(clerkUser);
  if (primaryEmail) {
    await serviceDb
      .prepare(
        `UPDATE public.vis_users
         SET email = ?, email_confirmed_at = COALESCE(email_confirmed_at, ?)
         WHERE id = ? AND disabled_at IS NULL`,
      )
      .run(primaryEmail, verifiedAt, mapped.id);
  }

  await setClerkSessionCookie(config, String(clerkUser.id));
  return {};
}

export async function clerkSignUpWithPassword(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  const config = getAuthConfig();
  if (config.provider !== "clerk") {
    return { error: "Clerk authentication is not active" };
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const appUserId = crypto.randomUUID();
  const createRes = await clerkBackendRequest<any>(
    config.secretKey,
    "POST",
    "/v1/users",
    {
      external_id: appUserId,
      email_address: [normalizedEmail],
      password,
    },
  );
  if (createRes.status !== 200 && createRes.status !== 201) {
    const clerkMsg =
      createRes.data?.errors?.[0]?.long_message ??
      createRes.data?.errors?.[0]?.message ??
      "Unable to create account";
    return { error: String(clerkMsg) };
  }

  const clerkUser = createRes.data;
  const { email: primaryEmail, verifiedAt } =
    extractClerkPrimaryEmail(clerkUser);

  await serviceDb.transaction(async (tx) => {
    await tx
      .prepare(
        `INSERT INTO public.vis_users (id, email, email_confirmed_at)
         VALUES (?, ?, ?)`,
      )
      .run(appUserId, primaryEmail ?? normalizedEmail, verifiedAt);
    await tx
      .prepare(
        `INSERT INTO vis_private.identity_map (provider, issuer, subject, user_id)
         VALUES ('clerk', ?, ?, ?)`,
      )
      .run(config.issuer, String(clerkUser.id), appUserId);
  });

  await setClerkSessionCookie(config, String(clerkUser.id));
  return {};
}

export async function clerkUpdatePasswordForCurrentUser(
  newPassword: string,
): Promise<{ error?: string; email?: string | null }> {
  const config = getAuthConfig();
  if (config.provider !== "clerk") {
    return { error: "Clerk authentication is not active" };
  }
  const user = await getAuthenticatedUser();
  if (!user || user.provider !== "clerk") {
    return { error: "Not authenticated" };
  }

  const patchRes = await clerkBackendRequest<any>(
    config.secretKey,
    "PATCH",
    `/v1/users/${encodeURIComponent(user.providerUserId)}`,
    { password: newPassword },
  );
  if (patchRes.status !== 200) {
    const clerkMsg =
      patchRes.data?.errors?.[0]?.long_message ??
      patchRes.data?.errors?.[0]?.message ??
      "Unable to update password";
    return { error: String(clerkMsg) };
  }

  await setClerkSessionCookie(config, user.providerUserId);
  return { email: user.email };
}

export async function clerkSignOutCurrentUser(): Promise<void> {
  const cookieStore = await cookies();
  try {
    const config = getAuthConfig();
    if (config.provider === "clerk") {
      const token =
        cookieStore.get(CLERK_SESSION_COOKIE)?.value ||
        cookieStore.get("__session")?.value;
      const verified = verifyClerkSessionToken(token, {
        issuer: config.issuer,
        secretKey: config.secretKey,
      });
      if (verified?.sessionId) {
        await clerkBackendRequest(
          config.secretKey,
          "POST",
          `/v1/sessions/${encodeURIComponent(verified.sessionId)}/revoke`,
        ).catch(() => {});
      }
    }
  } catch {
    // Ignore config errors on signout and clear cookies anyway.
  }
  cookieStore.delete(CLERK_SESSION_COOKIE);
  cookieStore.delete("__session");
}
