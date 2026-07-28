import { serviceDb as db } from "./db";

// Security/account-activity log — member changes, auth changes, integration
// connections. Distinct from the "Audits" (business-visibility) feature this
// app is named after; this is the SaaS-standard "who did what, when" trail.
// Callers already have accountId scoped (via getCurrentAccountId() or an
// engine job's account_id) — this just records the event, it doesn't scope
// anything itself.
export async function logAuditEvent(
  accountId: number,
  action: string,
  description: string,
  actorEmail?: string | null,
  costUsd?: number | null
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO vis_audit_log (account_id, actor_email, action, description, cost_usd)
       VALUES (@account_id, @actor_email, @action, @description, @cost_usd)`
    )
    .run({
      account_id: accountId,
      actor_email: actorEmail ?? null,
      action,
      description,
      cost_usd: costUsd ?? null,
    });
}
