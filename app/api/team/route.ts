import { NextResponse } from "next/server";
import { getCurrentAccountId, serviceDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Member emails live in auth.users, not vis_account_users, so listing/adding
// members needs serviceDb (the raw DATABASE_URL connection, already used for
// engine writes) — RLS doesn't gate a direct superuser Postgres connection,
// and every query here is explicitly scoped by an account_id resolved
// through the impersonated getCurrentAccountId() first, the same
// defense-in-depth pattern scripts/engine.ts already uses.
export async function GET() {
  const accountId = await getCurrentAccountId();
  const members = await serviceDb
    .prepare(
      `SELECT au.user_id, au.role, u.email
       FROM vis_account_users au
       JOIN auth.users u ON u.id = au.user_id
       WHERE au.account_id = ?
       ORDER BY au.created_at`
    )
    .all(accountId);
  return NextResponse.json({ members });
}

export async function POST(req: Request) {
  const accountId = await getCurrentAccountId();
  const { email } = await req.json();
  const trimmed = String(email ?? "").trim().toLowerCase();
  if (!trimmed) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = (await serviceDb
    .prepare("SELECT id FROM auth.users WHERE lower(email) = ?")
    .get(trimmed)) as { id: string } | undefined;
  if (!user) {
    return NextResponse.json(
      { error: "No account found with that email — they need to sign up first." },
      { status: 404 }
    );
  }

  await serviceDb
    .prepare(
      `INSERT INTO vis_account_users (account_id, user_id, role)
       VALUES (@account_id, @user_id, 'member')
       ON CONFLICT (account_id, user_id) DO NOTHING`
    )
    .run({ account_id: accountId, user_id: user.id });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const accountId = await getCurrentAccountId();
  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const { n } = (await serviceDb
    .prepare("SELECT COUNT(*)::int AS n FROM vis_account_users WHERE account_id = ?")
    .get(accountId)) as { n: number };
  if (n <= 1) {
    return NextResponse.json({ error: "Can't remove the last member of an account" }, { status: 400 });
  }

  await serviceDb
    .prepare("DELETE FROM vis_account_users WHERE account_id = ? AND user_id = ?")
    .run(accountId, user_id);

  return NextResponse.json({ ok: true });
}
