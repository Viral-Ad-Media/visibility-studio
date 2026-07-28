import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

// vis_start_trial() is SECURITY DEFINER and resolves the caller's account via
// auth.uid() internally — the impersonated db connection is what makes
// auth.uid() resolve inside the function body, same pattern as
// vis_create_account_with_owner() in app/(auth)/actions.ts. Self-limiting:
// a no-op (not an error) if a trial was already started or access is
// already granted.
export async function POST() {
  await db.prepare("SELECT vis_start_trial()").get();
  return NextResponse.json({ ok: true });
}
