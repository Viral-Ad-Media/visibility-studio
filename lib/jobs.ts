import type { Db } from "./db";

export type EnqueueableJobType = "run_audit" | "build_redesign" | "create_booking_link";

// Clients can't INSERT into vis_jobs directly (RLS, migration
// vis_rls_lockdown) — every job goes through the vis_enqueue_job() RPC, which
// checks the target belongs to the caller's account, builds the payload
// itself from the target row, refuses at a $0 credit balance, and (for
// campaign jobs) resets that row's status/error to pending. `targetId` is the
// audit id for run_audit and the campaign_business id for the other two.
// Pass the impersonated `db` (or a transaction from it) — auth.uid() has to
// resolve inside the RPC.
export async function enqueueJob(
  database: Db,
  type: EnqueueableJobType,
  targetId: number
): Promise<number> {
  const row = await database
    .prepare("SELECT vis_enqueue_job(@type::text, @target_id::bigint) AS id")
    .get({ type, target_id: targetId });
  return row!.id;
}

// The RPC raises this when the balance hit $0 between the route's own
// pre-check and the insert.
export function isInsufficientCredits(err: unknown): boolean {
  return err instanceof Error && err.message === "insufficient_credits";
}
