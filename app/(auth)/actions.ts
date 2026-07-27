"use server";

import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server";
import db from "@/lib/db";

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

  const { data, error } = await supabaseServerClient().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding` },
  });
  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }
  if (!data.session) {
    // Email confirmation is required before a session exists — nothing to
    // onboard into yet.
    redirect("/login?checkEmail=1");
  }
  redirect("/onboarding");
}

export async function logout() {
  await supabaseServerClient().auth.signOut();
  redirect("/");
}

export async function createAccount(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    redirect("/onboarding?error=" + encodeURIComponent("Account name is required"));
  }
  // Explicit cast: pg sends bare params with no type OID ("unknown"), and a
  // direct function call (unlike an INSERT/UPDATE) has no column to infer
  // the type from, so Postgres can't resolve the overload without a hint.
  await db.prepare("SELECT vis_create_account_with_owner(@name::text) AS id").get({ name });
  redirect("/app");
}
