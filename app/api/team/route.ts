import { NextResponse } from "next/server";
import db, { getCurrentMembership, serviceDb } from "@/lib/db";
import { logAuditEvent } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

// Member emails live in auth.users, not vis_account_users, so listing members
// needs serviceDb (the raw DATABASE_URL connection, already used for engine
// writes) — RLS doesn't gate a direct superuser Postgres connection, and every
// query here is explicitly scoped by an account_id resolved through the
// impersonated getCurrentMembership() first, the same defense-in-depth pattern
// scripts/engine.ts already uses.
//
// Adding a member is an *invitation*, never a direct vis_account_users insert:
// that row is what every RLS policy keys off, so creating one for someone who
// never agreed silently attaches them to this tenant (and, because
// getCurrentMembership() then has two rows to choose from, can route their own
// work into someone else's account). vis_respond_to_invitation() is the only
// path that turns an invitation into a membership, and only the invitee can
// call it. Role is enforced here too — 'member' is read-only over the team.

export async function GET() {
  const { accountId, userId, role } = await getCurrentMembership();

  const [members, invitations] = await Promise.all([
    serviceDb
      .prepare(
        `SELECT au.user_id, au.role, u.email
         FROM vis_account_users au
         JOIN auth.users u ON u.id = au.user_id
         WHERE au.account_id = ?
         ORDER BY au.created_at`
      )
      .all(accountId),
    // Impersonated: the tenant policy already scopes this to the caller's account.
    db
      .prepare(
        `SELECT id, email, created_at FROM vis_account_invitations
         WHERE account_id = ? AND status = 'pending' ORDER BY id`
      )
      .all(accountId),
  ]);

  return NextResponse.json({ members, invitations, currentUserId: userId, currentRole: role });
}

export async function POST(req: Request) {
  const { accountId, userId, role } = await getCurrentMembership();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only an owner can invite members" }, { status: 403 });
  }

  const { email } = await req.json();
  const trimmed = String(email ?? "").trim().toLowerCase();
  if (!trimmed || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  // Deliberately does NOT check whether this email has an account. The old
  // version did, which made this endpoint an email-enumeration oracle over
  // every user in the shared Supabase project. An invitation to an address
  // that hasn't signed up yet just sits pending until they do.
  const alreadyMember = (await serviceDb
    .prepare(
      `SELECT 1 AS hit FROM vis_account_users au
       JOIN auth.users u ON u.id = au.user_id
       WHERE au.account_id = ? AND lower(u.email) = ?`
    )
    .get(accountId, trimmed)) as { hit: number } | undefined;
  if (alreadyMember) {
    return NextResponse.json({ error: "That person is already on the team" }, { status: 400 });
  }

  const actorEmail = (await serviceDb
    .prepare("SELECT email FROM auth.users WHERE id = ?")
    .get(userId)) as { email: string } | undefined;

  try {
    await db
      .prepare(
        `INSERT INTO vis_account_invitations (account_id, email, invited_by_email)
         VALUES (@account_id, @email, @invited_by_email) RETURNING id`
      )
      .run({ account_id: accountId, email: trimmed, invited_by_email: actorEmail?.email ?? null });
  } catch (err) {
    // Partial unique index on (account_id, lower(email)) where status='pending'.
    if ((err as { code?: string }).code === "23505") {
      return NextResponse.json({ ok: true, already_invited: true });
    }
    throw err;
  }

  await logAuditEvent(
    accountId,
    "member_invited",
    `${actorEmail?.email ?? "Someone"} invited ${trimmed} to the team`,
    actorEmail?.email ?? null
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { accountId, userId, role } = await getCurrentMembership();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only an owner can remove members" }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  const target = (await serviceDb
    .prepare("SELECT role FROM vis_account_users WHERE account_id = ? AND user_id = ?")
    .get(accountId, user_id)) as { role: string } | undefined;
  if (!target) {
    return NextResponse.json({ error: "That person isn't on this team" }, { status: 404 });
  }
  // An owner is the account's root of trust — nothing in the app can remove
  // one, including another owner. Prevents a team takeover and keeps every
  // account with at least one owner by construction.
  if (target.role === "owner") {
    return NextResponse.json({ error: "An owner can't be removed" }, { status: 400 });
  }

  const removed = (await serviceDb
    .prepare("SELECT email FROM auth.users WHERE id = ?")
    .get(user_id)) as { email: string } | undefined;

  await serviceDb
    .prepare("DELETE FROM vis_account_users WHERE account_id = ? AND user_id = ?")
    .run(accountId, user_id);

  const actorEmail = (await serviceDb
    .prepare("SELECT email FROM auth.users WHERE id = ?")
    .get(userId)) as { email: string } | undefined;
  await logAuditEvent(
    accountId,
    "member_removed",
    `${actorEmail?.email ?? "Someone"} removed ${removed?.email ?? user_id} from the team`,
    actorEmail?.email ?? null
  );

  return NextResponse.json({ ok: true });
}
