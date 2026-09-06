import db, { serviceDb } from "./db";
import { supabaseServerClient } from "./supabase-server";

export type MyInvitation = {
  id: number;
  account_name: string;
  invited_by_email: string | null;
};

/**
 * Pending invitations addressed to the signed-in user, from any account.
 *
 * Deliberately two queries rather than one JOIN. `vis_accounts`' read policy
 * requires an existing membership, and the whole point of an invitation is
 * that the invitee is *not* a member yet — so joining `vis_account_invitations`
 * to `vis_accounts` on the impersonated connection silently returns zero rows.
 * The invitation rows come back RLS-scoped (the invitee-read policy matches the
 * email claim), and only then do we resolve the account names via `serviceDb`,
 * for exactly the account ids those rows already authorized.
 *
 * The email filter is explicit rather than left to RLS alone: a user who
 * belongs to several accounts can also read the invitations *their own*
 * accounts sent, via the tenant policy, and those are not addressed to them.
 */
export async function listMyInvitations(): Promise<MyInvitation[]> {
  const email = (await supabaseServerClient().auth.getUser()).data.user?.email;
  if (!email) return [];

  const rows = (await db
    .prepare(
      `SELECT id, account_id, invited_by_email FROM vis_account_invitations
       WHERE status = 'pending' AND lower(email) = lower(?)
       ORDER BY id DESC`
    )
    .all(email)) as { id: number; account_id: number; invited_by_email: string | null }[];
  if (rows.length === 0) return [];

  const names = (await serviceDb
    .prepare("SELECT id, name FROM vis_accounts WHERE id = ANY(?)")
    .all([rows.map((r) => r.account_id)])) as { id: number; name: string }[];
  const byId = new Map(names.map((n) => [n.id, n.name]));

  return rows.map((r) => ({
    id: r.id,
    account_name: byId.get(r.account_id) ?? "Unknown account",
    invited_by_email: r.invited_by_email,
  }));
}
