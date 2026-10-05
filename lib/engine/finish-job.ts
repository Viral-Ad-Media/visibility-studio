import type { Db } from "../db";

export type ClaimedJob = {
  id: number;
  account_id: number;
  attempts: number;
  type: string;
};
/** Artifact, fan-out, completion and debit share one commit. A stale attempt writes nothing. */
export async function finishJob(
  database: Db,
  job: ClaimedJob,
  result: { estimated_cost_usd: number; [key: string]: unknown },
  write: (tx: Db) => Promise<void> = async () => {},
): Promise<boolean> {
  const cost = result.estimated_cost_usd;
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Invalid usage cost");
  return database.transaction(async (tx) => {
    const current = await tx
      .prepare(
        "SELECT status, attempts, account_id FROM vis_jobs WHERE id = ? FOR UPDATE",
      )
      .get(job.id);
    if (
      !current ||
      current.status !== "running" ||
      current.attempts !== job.attempts ||
      current.account_id !== job.account_id
    )
      return false;
    await write(tx);
    if (cost > 0)
      await tx
        .prepare(
          "INSERT INTO vis_credits_ledger (account_id, delta_usd, reason) VALUES (?, ?, ?)",
        )
        .run(job.account_id, -cost, `${job.type}:${job.id}`);
    await tx
      .prepare(
        "UPDATE vis_jobs SET status='done', result=?, reserved_usd=0, updated_at=now()::text WHERE id = ?",
      )
      .run(JSON.stringify(result), job.id);
    return true;
  });
}
