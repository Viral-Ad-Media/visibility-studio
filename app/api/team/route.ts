import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getCurrentAccountId,
  serviceDb,
  getRequestAccount,
  type Db,
} from "@/lib/db";
import { ApiError, apiRoute, parseBody, requireOwner } from "@/lib/api";
import { safeLogAuditEvent } from "@/lib/auditLog";
export const dynamic = "force-dynamic";

async function lockOwner(tx: Db, accountId: number, userId: string) {
  await tx
    .prepare("SELECT id FROM vis_accounts WHERE id = ? FOR UPDATE")
    .get(accountId);
  const member = await tx
    .prepare(
      "SELECT role FROM vis_account_users WHERE account_id = ? AND user_id = ?",
    )
    .get(accountId, userId);
  if (member?.role !== "owner")
    throw new ApiError("Only owners can manage the team", 403);
}
export const GET = apiRoute(async () => {
  const accountId = await getCurrentAccountId();
  const members = await serviceDb
    .prepare(
      `SELECT au.user_id, au.role, u.email FROM vis_account_users au
    JOIN auth.users u ON u.id = au.user_id WHERE au.account_id = ? ORDER BY au.created_at`,
    )
    .all(accountId);
  return NextResponse.json({ members });
});
export const POST = apiRoute(async (req: Request) => {
  const { accountId, userId } = await requireOwner();
  const { email } = await parseBody(
    req,
    z.object({ email: z.string().trim().email().max(254) }),
  );
  await serviceDb.transaction(async (tx) => {
    await lockOwner(tx, accountId!, userId);
    await tx
      .prepare(
        `INSERT INTO vis_team_invites (account_id, email, invited_by) VALUES (?, ?, ?)
      ON CONFLICT (account_id, email) DO UPDATE SET invited_by=EXCLUDED.invited_by RETURNING account_id`,
      )
      .run(accountId, email.toLowerCase(), userId);
  });
  await safeLogAuditEvent(
    accountId!,
    "member_invited",
    `Team invitation created for ${email}`,
  );
  return NextResponse.json({
    ok: true,
    message:
      "Invitation created. They can accept it from their account menu after signing in.",
  });
});
export const DELETE = apiRoute(async (req: Request) => {
  const { accountId, userId } = await requireOwner();
  const { user_id } = await parseBody(
    req,
    z.object({ user_id: z.string().uuid() }),
  );
  await serviceDb.transaction(async (tx) => {
    await lockOwner(tx, accountId!, userId);
    const target = await tx
      .prepare(
        "SELECT role FROM vis_account_users WHERE account_id = ? AND user_id = ?",
      )
      .get(accountId, user_id);
    if (!target) throw new ApiError("Member not found", 404);
    if (target.role === "owner") {
      const owners = await tx
        .prepare(
          "SELECT COUNT(*) AS n FROM vis_account_users WHERE account_id = ? AND role = 'owner'",
        )
        .get(accountId);
      if (Number(owners?.n) <= 1)
        throw new ApiError("Cannot remove the last owner", 409);
    }
    await tx
      .prepare(
        "DELETE FROM vis_account_users WHERE account_id = ? AND user_id = ?",
      )
      .run(accountId, user_id);
  });
  await safeLogAuditEvent(
    accountId!,
    "member_removed",
    `Team member ${user_id} removed`,
  );
  return NextResponse.json({ ok: true });
});
