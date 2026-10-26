"use server";

import { redirect } from "next/navigation";
import { clerkSignOutCurrentUser } from "@/lib/auth";
import db from "@/lib/db";

export async function logout() {
  await clerkSignOutCurrentUser();
  redirect("/");
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
