"use server";

import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server";
import db, { getCurrentAccountId } from "@/lib/db";
import { logAuditEvent } from "@/lib/auditLog";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");

  const { error } = await supabaseServerClient().auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ref = String(formData.get("ref") ?? "").trim();
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : "";

  const { data, error } = await supabaseServerClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding${refQuery}` },
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

export async function logout() {
  await supabaseServerClient().auth.signOut();
  redirect("/");
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    redirect(
      "/app/settings?password_error=" + encodeURIComponent("Password must be at least 8 characters")
    );
  }
  if (password !== confirmPassword) {
    redirect("/app/settings?password_error=" + encodeURIComponent("Passwords don't match"));
  }

  const client = supabaseServerClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) {
    redirect("/app/settings?password_error=" + encodeURIComponent(error.message));
  }

  const email = (await client.auth.getUser()).data.user?.email ?? null;
  const accountId = await getCurrentAccountId();
  await logAuditEvent(accountId, "password_changed", `${email ?? "Someone"} changed their password`, email);

  redirect("/app/settings?password_changed=1");
}

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/onboarding?error=" + encodeURIComponent("Account name is required"));
  }
  const ref = String(formData.get("ref") ?? "").trim() || null;
  // Explicit cast: pg sends bare params with no type OID ("unknown"), and a
  // direct function call (unlike an INSERT/UPDATE) has no column to infer
  // the type from, so Postgres can't resolve the overload without a hint.
  // An unknown/garbage ref code is a silent no-op inside the RPC itself —
  // never blocks account creation over a bad referral link.
  await db
    .prepare("SELECT vis_create_account_with_owner(@name::text, @ref::text) AS id")
    .get({ name, ref });
  redirect("/app");
}
