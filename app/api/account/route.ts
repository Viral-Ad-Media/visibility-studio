import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, parseBody, positiveId, ApiError } from "@/lib/api";
import { serviceDb, getRequestAccount } from "@/lib/db";
import { supabaseServerClient } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export const GET = apiRoute(async () => {
  const { userId, accountId } = await getRequestAccount();
  const user = (await (await supabaseServerClient()).auth.getUser()).data.user!;
  const accounts = await serviceDb
    .prepare(
      `SELECT a.id, a.name FROM vis_accounts a JOIN vis_account_users au ON au.account_id=a.id
    WHERE au.user_id=? ORDER BY a.id LIMIT 100`,
    )
    .all(userId);
  const invites = user.email_confirmed_at
    ? await serviceDb
        .prepare(
          `SELECT i.account_id, a.name FROM vis_team_invites i JOIN vis_accounts a ON a.id=i.account_id
    WHERE i.email=? ORDER BY i.created_at DESC LIMIT 100`,
        )
        .all(user.email?.toLowerCase())
    : [];
  return NextResponse.json({ accounts, invites, accountId });
}, false);
export const POST = apiRoute(async (req: Request) => {
  const { userId } = await getRequestAccount();
  const user = (await (await supabaseServerClient()).auth.getUser()).data.user!;
  const { account_id, accept } = await parseBody(
    req,
    z.object({ account_id: positiveId, accept: z.boolean().default(false) }),
  );
  await serviceDb.transaction(async (tx) => {
    await tx
      .prepare("SELECT id FROM vis_accounts WHERE id = ? FOR UPDATE")
      .get(account_id);
    if (accept) {
      if (!user.email_confirmed_at)
        throw new ApiError(
          "Confirm your email before accepting an invitation",
          403,
        );
      const invitation = await tx
        .prepare(
          "SELECT account_id FROM vis_team_invites WHERE account_id = ? AND email = ? FOR UPDATE",
        )
        .get(account_id, user.email?.toLowerCase());
      if (!invitation) throw new ApiError("Invitation not found", 404);
      await tx
        .prepare(
          `INSERT INTO vis_account_users (account_id,user_id,role) VALUES (?,?,'member') ON CONFLICT (account_id,user_id) DO NOTHING`,
        )
        .run(account_id, userId);
      await tx
        .prepare("DELETE FROM vis_team_invites WHERE account_id=? AND email=?")
        .run(account_id, user.email?.toLowerCase());
    }
    const membership = await tx
      .prepare(
        "SELECT account_id FROM vis_account_users WHERE account_id=? AND user_id=?",
      )
      .get(account_id, userId);
    if (!membership) throw new ApiError("Account not found", 404);
  });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("vis_account_id", String(account_id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}, false);
