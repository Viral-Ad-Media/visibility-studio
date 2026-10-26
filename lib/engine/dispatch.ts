import { after } from "next/server";
import { serviceDb } from "@/lib/db";

// Replaces the old database-side dispatch (a pg_net trigger on vis_jobs plus a
// pg_cron backstop), which Neon doesn't provide. Each /api/engine/run call
// processes one job, so the app wakes the engine itself: after a route queues
// work, and again after every engine run while claimable work remains. The
// wake-up only needs the request to land — Vercel keeps the engine function
// running after this caller hangs up (request cancellation is opt-in), the
// same fire-and-forget shape pg_net had.
const WAKE_TIMEOUT_MS = 5000;
// Roughly the old trigger's concurrency: a fan-out of N audit_business jobs
// is worked by at most this many engine invocations at once.
export const MAX_PARALLEL_WAKES = 3;

function engineUrl(): string | null {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL || (host ? `https://${host}` : null);
  return base ? new URL("/api/engine/run", base).toString() : null;
}

// How many more engine invocations to start: one per job vis_claim_job_v2
// could hand out right now (pending, or running but stale for 6 minutes,
// under the attempt cap), less the runs already in flight, so the chain
// tops concurrency back up to MAX_PARALLEL_WAKES instead of multiplying.
export async function engineWakesNeeded(): Promise<number> {
  const row = await serviceDb
    .prepare(
      `SELECT
         count(*) FILTER (WHERE attempts < 5 AND (status = 'pending'
           OR (status = 'running' AND updated_at::timestamptz < now() - interval '6 minutes')))::int AS claimable,
         count(*) FILTER (WHERE status = 'running'
           AND updated_at::timestamptz >= now() - interval '6 minutes')::int AS active
       FROM vis_jobs WHERE status IN ('pending', 'running')`,
    )
    .get();
  const claimable = Number(row?.claimable ?? 0);
  const active = Number(row?.active ?? 0);
  return Math.max(0, Math.min(claimable, MAX_PARALLEL_WAKES - active));
}

async function wake(url: string, secret: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-engine-secret": secret },
      body: "{}",
      signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
    });
  } catch {
    // A timeout is the normal outcome: the engine run outlives this wait.
  }
}

export async function wakeEngine(times = 1): Promise<void> {
  const url = engineUrl();
  const secret = process.env.ENGINE_WEBHOOK_SECRET;
  if (!url || !secret) {
    console.error("Engine wake-up skipped: no site URL or ENGINE_WEBHOOK_SECRET");
    return;
  }
  const count = Math.max(0, Math.min(times, MAX_PARALLEL_WAKES));
  await Promise.all(Array.from({ length: count }, () => wake(url, secret)));
}

// For request handlers that just queued jobs: wake the engine once the
// response has been sent, so the user never waits on it.
export function wakeEngineAfterResponse(times = 1): void {
  after(() => wakeEngine(times));
}
