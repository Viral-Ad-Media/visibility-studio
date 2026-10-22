"use server";

import { redirect } from "next/navigation";
import { getAuthConfig } from "@/lib/auth-config";
import {
  clerkSignInWithPassword,
  clerkSignOutCurrentUser,
  clerkSignUpWithPassword,
  clerkUpdatePasswordForCurrentUser,
} from "@/lib/auth";
import { supabaseServerClient } from "@/lib/supabase-server";
import db, { getCurrentAccountId } from "@/lib/db";
import { safeLogAuditEvent as logAuditEvent } from "@/lib/auditLog";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // `next` round-trips through a query string anyone can craft, so only
  // follow same-site paths — "//evil.com" or "https://evil.com" would
  // otherwise turn the login form into an open redirect.
  const rawNext = String(formData.get("next") ?? "/app");
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.startsWith("/\\")
      ? rawNext
      : "/app";

  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    const { error } = await clerkSignInWithPassword(email, password);
    if (error) {
      redirect(
        `/login?error=${encodeURIComponent(error)}&next=${encodeURIComponent(next)}`,
      );
    }
    redirect(next);
  }

  const { error } = await (
    await supabaseServerClient()
  ).auth.signInWithPassword({ email, password });
  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";

  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    const { error } = await clerkSignUpWithPassword(email, password);
    if (error) {
      redirect(`/signup?error=${encodeURIComponent(error)}`);
    }
    redirect(`/onboarding${refQuery}`);
  }

  const { data, error } = await (
    await supabaseServerClient()
  ).auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding${refQuery}`,
    },
  });
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  if (!data.session) {
    // Email confirmation is required before a session exists — nothing to
    // onboard into yet.
    redirect("/login?checkEmail=1");
  }
  redirect(`/onboarding${refQuery}`);
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    redirect("/forgot-password?sent=1");
  }
  // The link lands on /auth/confirm, which turns it into a session and then
  // sends the user on to /reset-password to pick a new password. That URL
  // must be in Supabase Auth's allowed redirect URLs.
  const { error } = await (
    await supabaseServerClient()
  ).auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  });
  // Rate limits are worth surfacing; everything else gets the same reply
  // whether or not the address has an account, so the form can't be used
  // to find out who has signed up.
  if (error && error.status === 429) {
    redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/forgot-password?sent=1");
}

export async function resetPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    redirect(
      "/reset-password?error=" +
        encodeURIComponent("Password must be at least 8 characters"),
    );
  }
  if (password !== confirmPassword) {
    redirect(
      "/reset-password?error=" + encodeURIComponent("Passwords don't match"),
    );
  }

  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    const { error, email } = await clerkUpdatePasswordForCurrentUser(password);
    if (error) {
      redirect("/reset-password?error=" + encodeURIComponent(error));
    }
    const accountId = await getCurrentAccountId().catch(() => null);
    if (accountId) {
      await logAuditEvent(
        accountId,
        "password_changed",
        `${email ?? "Someone"} reset their password`,
        email ?? null,
      );
    }
    redirect("/app/settings?password_changed=1");
  }

  const client = await supabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("That reset link has expired. Request a new one."),
    );
  }

  const { error } = await client.auth.updateUser({ password });
  if (error) {
    redirect("/reset-password?error=" + encodeURIComponent(error.message));
  }

  const accountId = await getCurrentAccountId().catch(() => null);
  if (accountId) {
    await logAuditEvent(
      accountId,
      "password_changed",
      `${user.email ?? "Someone"} reset their password`,
      user.email ?? null,
    );
  }

  redirect("/app/settings?password_changed=1");
}

export async function logout() {
  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    await clerkSignOutCurrentUser();
    redirect("/");
  }
  await (await supabaseServerClient()).auth.signOut();
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    redirect(
      "/app/settings?password_error=" +
        encodeURIComponent("Password must be at least 8 characters"),
    );
  }
  if (password !== confirmPassword) {
    redirect(
      "/app/settings?password_error=" +
        encodeURIComponent("Passwords don't match"),
    );
  }

  const authConfig = getAuthConfig();
  if (authConfig.provider === "clerk") {
    const { error, email } = await clerkUpdatePasswordForCurrentUser(password);
    if (error) {
      redirect("/app/settings?password_error=" + encodeURIComponent(error));
    }
    const accountId = await getCurrentAccountId();
    await logAuditEvent(
      accountId,
      "password_changed",
      `${email ?? "Someone"} changed their password`,
      email ?? null,
    );
    redirect("/app/settings?password_changed=1");
  }

  const client = await supabaseServerClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    redirect(
      "/app/settings?password_error=" + encodeURIComponent(error.message),
    );
  }

  const email = (await client.auth.getUser()).data.user?.email ?? null;
  const accountId = await getCurrentAccountId();
  await logAuditEvent(
    accountId,
    "password_changed",
    `${email ?? "Someone"} changed their password`,
    email,
  );

  redirect("/app/settings?password_changed=1");
}

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 200) {
    redirect(
      "/onboarding?error=" + encodeURIComponent("Account name is required"),
    );
  }
  const ref = String(formData.get("ref") ?? "").trim() || null;
  // Explicit cast: pg sends bare params with no type OID ("unknown"), and a
  // direct function call (unlike an INSERT/UPDATE) has no column to infer
  // the type from, so Postgres can't resolve the overload without a hint.
  // An unknown/garbage ref code is a silent no-op inside the RPC itself —
  // never blocks account creation over a bad referral link.
  //
  // The RPC caps each user at one *owned* account — stops repeat
  // $20 trial-credit farming. Someone who already owns one (e.g. revisited
  // /onboarding, or double-submitted) just lands in their existing account.
  try {
    await db
      .prepare(
        "SELECT vis_create_account_guarded(@name::text, @ref::text) AS id",
      )
      .get({ name, ref });
  } catch (err) {
    if (!(err instanceof Error && err.message === "you already own an account"))
      throw err;
  }
  redirect("/app");
}
