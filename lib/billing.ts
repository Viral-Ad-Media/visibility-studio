import { serviceDb as db } from "./db";

// Credit balance funds real audit/campaign job cost — the engine worker
// deducts the actual estimated_cost_usd of each completed job here, and
// app/api/audits + app/api/campaigns refuse to queue new work once an
// account's balance is at or below zero. Distinct from vis_audit_log's
// cost_usd, which is a read-only display of the same spend, not a second
// ledger — this table is the one source of truth for "can this account
// afford to run something."
export async function getCreditBalance(accountId: number): Promise<number> {
  const { balance } = (await db
    .prepare("SELECT COALESCE(SUM(delta_usd), 0) AS balance FROM vis_credits_ledger WHERE account_id = ?")
    .get(accountId)) as { balance: string | null };
  return Number(balance) || 0;
}

export async function deductCredits(accountId: number, amountUsd: number, reason: string): Promise<void> {
  if (amountUsd <= 0) return;
  await db
    .prepare("INSERT INTO vis_credits_ledger (account_id, delta_usd, reason) VALUES (@account_id, @delta_usd, @reason)")
    .run({ account_id: accountId, delta_usd: -amountUsd, reason });
}
