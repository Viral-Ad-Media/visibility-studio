import { NextResponse } from "next/server";
import db, { getCurrentMembership } from "@/lib/db";
import { listMyInvitations } from "@/lib/team";
import { logAuditEvent } from "@/lib/auditLog";

export const dynamic = "force-dynamic";

// The invitee's side of the team flow. Reads go through the impersonated `db`
// connection, where vis_account_invitations' invitee-read policy scopes rows to
// the caller's own email claim — so this route never has to filter by email
// itself, and can't be tricked into listing someone else's invitations.

// Invitations addressed to the signed-in user. Not scoped to an account: the
// whole point is that the caller is not yet a member of the inviting one.
export async function GET() {
  return NextResponse.json({ invitations: await listMyInvitations() });
}

// Accept or decline. vis_respond_to_invitation() is SECURITY DEFINER (it has to
// be — vis_account_users has no INSERT policy) and re-derives the caller's email
// from auth.users rather than the JWT claim, so it can only ever act on an
// invitation genuinely addressed to whoever is signed in.
export async function POST(req: Request) {
  const body = await req.json();
  const invitationId = Number(body.invitation_id);
  const accept = body.accept === true;
  if (!Number.isFinite(invitationId)) {
    return NextResponse.json({ error: "invitation_id is required" }, { status: 400 });
  }

  let result: string;
  try {
    const row = (await db
      .prepare("SELECT vis_respond_to_invitation(@id::bigint, @accept::boolean) AS result")
      .get({ id: invitationId, accept })) as { result: string };
    result = row.result;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, result });
}

// Revoke an invitation this account sent. Owner-only, same as issuing one.
export async function DELETE(req: Request) {
  const { accountId, role } = await getCurrentMembership();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only an owner can revoke invitations" }, { status: 403 });
  }

  const invitationId = Number((await req.json()).invitation_id);
  if (!Number.isFinite(invitationId)) {
    return NextResponse.json({ error: "invitation_id is required" }, { status: 400 });
  }

  const info = await db
    .prepare(
      "DELETE FROM vis_account_invitations WHERE id = ? AND account_id = ? AND status = 'pending'"
    )
    .run(invitationId, accountId);
  if (info.changes === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await logAuditEvent(accountId, "invitation_revoked", `Invitation ${invitationId} revoked`);
  return NextResponse.json({ ok: true });
}
