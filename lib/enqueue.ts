import { NextResponse } from "next/server";
import type { Db } from "./db";

// Clients can't write vis_jobs directly (RLS is SELECT-only for
// `authenticated` — migration vis_rls_hardening). Every job a user queues
// goes through one of these SECURITY DEFINER RPCs instead, which check
// account membership and credit balance inside Postgres, so the same rules
// hold even for someone calling PostgREST with the public anon key.
// Both inserts fire the on_vis_job_inserted trigger (pg_net → /api/engine/run).

export type EnqueueResult = { job_id: number; already_queued: boolean };

export async function enqueueAuditJob(conn: Db, auditId: number): Promise<EnqueueResult> {
  const row = await conn
    .prepare("SELECT vis_enqueue_audit_job(?::bigint) AS r")
    .get(auditId);
  return row!.r as EnqueueResult;
}

export async function enqueueCampaignJob(
  conn: Db,
  campaignBusinessId: number,
  type: "build_redesign" | "create_booking_link"
): Promise<EnqueueResult> {
  const row = await conn
    .prepare("SELECT vis_enqueue_campaign_job(?::bigint, ?::text) AS r")
    .get(campaignBusinessId, type);
  return row!.r as EnqueueResult;
}

// Maps the RPCs' custom SQLSTATEs to HTTP responses; returns null for
// anything else so the caller rethrows.
export function enqueueErrorResponse(err: unknown, creditMessage: string): NextResponse | null {
  switch ((err as { code?: string }).code) {
    case "VS402":
      return NextResponse.json({ error: creditMessage }, { status: 402 });
    case "VS404":
      return NextResponse.json({ error: "not found" }, { status: 404 });
    case "VS400":
      return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    default:
      return null;
  }
}
