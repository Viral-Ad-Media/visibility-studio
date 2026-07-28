import { serviceDb as db } from "../db";
import { PRIORITY_ORDER, type Business } from "../shared";
import { discoverCandidates } from "./discover";
import { runAuditBusiness } from "./auditBusiness";
import { generateRedesign } from "./redesign";
import { createBookingLink } from "./booking";
import { logAuditEvent } from "../auditLog";

const MAX_ATTEMPTS = 5;

type JobRow = {
  id: number;
  type: "run_audit" | "audit_business" | "build_redesign" | "create_booking_link" | string;
  payload: string;
  status: string;
  attempts: number;
  account_id: number;
};

async function claimJob(): Promise<JobRow | null> {
  const job = (await db.prepare("SELECT * FROM vis_claim_job()").get()) as JobRow | null;
  return job && job.id != null ? job : null;
}

async function markDone(jobId: number, result: string) {
  await db
    .prepare("UPDATE vis_jobs SET status='done', result=?, updated_at=now()::text WHERE id = ?")
    .run(result, jobId);
}

function buildSummary(businesses: Business[]): string {
  const emailsFound = businesses.filter((b) => b.email && b.email !== "not found").length;
  const outreachDrafted = businesses.filter((b) => b.outreach_email).length;
  const byPriority = { High: 0, Medium: 0, Low: 0 } as Record<string, number>;
  for (const b of businesses) {
    if (b.priority && b.priority in byPriority) byPriority[b.priority]++;
  }
  const top3 = [...businesses]
    .sort(
      (a, b) =>
        (PRIORITY_ORDER[a.priority ?? ""] ?? 3) - (PRIORITY_ORDER[b.priority ?? ""] ?? 3) ||
        (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0)
    )
    .slice(0, 3);

  return [
    `**${businesses.length} businesses audited**. Emails found for ${emailsFound} of ${businesses.length}; ${outreachDrafted} outreach drafts generated (${byPriority.High} High, ${byPriority.Medium} Medium).`,
    "",
    "### Top opportunities",
    ...top3.map(
      (b, i) => `${i + 1}. **${b.name}** (${b.priority ?? "unscored"}) — opportunity score ${b.opportunity_score ?? "n/a"}`
    ),
  ].join("\n");
}

// If nothing is left pending/running for this audit's businesses, the audit is
// done — build the deterministic summary and mark it ready. Safe to call
// after every audit_business completion; a harmless no-op if not actually done
// yet, and idempotent if two completions race to finalize at once.
async function maybeFinalizeAudit(auditId: number) {
  const remaining = (await db
    .prepare(
      `SELECT COUNT(*)::int AS n FROM vis_jobs
       WHERE type = 'audit_business' AND status IN ('pending','running')
         AND (payload::json->>'audit_id')::bigint = ?`
    )
    .get(auditId)) as { n: number };
  if (remaining.n > 0) return;

  const businesses = (await db
    .prepare("SELECT * FROM vis_businesses WHERE audit_id = ? ORDER BY id")
    .all(auditId)) as Business[];
  const summary = buildSummary(businesses);
  const updated = (await db
    .prepare(
      `UPDATE vis_audits SET status='ready', error=NULL, summary_md=?, updated_at=now()::text
       WHERE id = ? AND status <> 'ready'
       RETURNING account_id, query`
    )
    .get(summary, auditId)) as { account_id: number; query: string } | undefined;

  // Only log once, on the actual pending->ready transition — this UPDATE is a
  // harmless no-op on repeat calls (two audit_business completions racing to
  // finalize), which would otherwise double-log the same audit.
  if (updated) {
    const { cost } = (await db
      .prepare(
        `SELECT SUM(COALESCE((result::json->>'estimated_cost_usd')::numeric, 0)) AS cost
         FROM vis_jobs
         WHERE type IN ('run_audit','audit_business') AND result LIKE '{%'
           AND (payload::json->>'audit_id')::bigint = ?`
      )
      .get(auditId)) as { cost: string | null };
    await logAuditEvent(
      updated.account_id,
      "audit_completed",
      `Audit "${updated.query}" completed — ${businesses.length} businesses audited`,
      null,
      Number(cost) || 0
    );
  }
}

async function processRunAudit(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const auditId = Number(payload.audit_id);
  if (!auditId) throw new Error(`run_audit job ${job.id} has no audit_id in its payload`);

  await db
    .prepare("UPDATE vis_audits SET status='running', error=NULL, updated_at=now()::text WHERE id = ?")
    .run(auditId);

  const { candidates, searchCallCount, estimatedCostUsd } = await discoverCandidates(auditId);

  if (!candidates.length) {
    const message = "No candidate businesses found for this niche + location";
    await db
      .prepare("UPDATE vis_audits SET status='error', error=?, updated_at=now()::text WHERE id = ?")
      .run(message, auditId);
    await markDone(job.id, message);
    return;
  }

  await db.transaction(async (tx) => {
    for (const c of candidates) {
      await tx.prepare("INSERT INTO vis_jobs (type, payload) VALUES ('audit_business', ?)").run(
        JSON.stringify({ audit_id: auditId, name: c.name, website: c.website ?? null })
      );
    }
  });

  await markDone(
    job.id,
    JSON.stringify({ search_call_count: searchCallCount, candidates: candidates.length, estimated_cost_usd: estimatedCostUsd })
  );
}

async function processAuditBusiness(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const auditId = Number(payload.audit_id);
  if (!auditId) throw new Error(`audit_business job ${job.id} has no audit_id in its payload`);

  const { businessId, created, searchCallCount, estimatedCostUsd } = await runAuditBusiness({
    audit_id: auditId,
    name: payload.name,
    website: payload.website ?? null,
  });

  await markDone(
    job.id,
    JSON.stringify({
      business_id: businessId,
      created,
      search_call_count: searchCallCount,
      estimated_cost_usd: estimatedCostUsd,
    })
  );
  await maybeFinalizeAudit(auditId);
}

async function processBuildRedesign(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const campaignBusinessId = Number(payload.campaign_business_id);
  if (!campaignBusinessId) {
    throw new Error(`build_redesign job ${job.id} has no campaign_business_id in its payload`);
  }

  await db
    .prepare(
      "UPDATE vis_campaign_businesses SET redesign_status='running', redesign_error=NULL, updated_at=now()::text WHERE id = ?"
    )
    .run(campaignBusinessId);

  const { html, estimatedCostUsd } = await generateRedesign(campaignBusinessId);

  await db
    .prepare(
      "UPDATE vis_campaign_businesses SET redesign_status='ready', redesign_error=NULL, redesign_html=?, updated_at=now()::text WHERE id = ?"
    )
    .run(html, campaignBusinessId);
  await markDone(job.id, JSON.stringify({ estimated_cost_usd: estimatedCostUsd }));

  const businessName = await campaignBusinessName(campaignBusinessId);
  await logAuditEvent(
    job.account_id,
    "redesign_built",
    `Redesign mockup built for "${businessName}"`,
    null,
    estimatedCostUsd
  );
}

async function processCreateBookingLink(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const campaignBusinessId = Number(payload.campaign_business_id);
  if (!campaignBusinessId) {
    throw new Error(`create_booking_link job ${job.id} has no campaign_business_id in its payload`);
  }

  await db
    .prepare(
      "UPDATE vis_campaign_businesses SET booking_status='running', booking_error=NULL, updated_at=now()::text WHERE id = ?"
    )
    .run(campaignBusinessId);

  const { bookingLink, eventTypeName, estimatedCostUsd } = await createBookingLink(job.account_id);

  await db
    .prepare(
      "UPDATE vis_campaign_businesses SET booking_status='ready', booking_error=NULL, booking_link=?, booking_event_type=?, updated_at=now()::text WHERE id = ?"
    )
    .run(bookingLink, eventTypeName, campaignBusinessId);
  await markDone(job.id, JSON.stringify({ estimated_cost_usd: estimatedCostUsd }));

  const businessName = await campaignBusinessName(campaignBusinessId);
  await logAuditEvent(
    job.account_id,
    "booking_link_created",
    `Booking link created for "${businessName}"`,
    null,
    estimatedCostUsd
  );
}

async function campaignBusinessName(campaignBusinessId: number): Promise<string> {
  const row = (await db
    .prepare(
      `SELECT b.name FROM vis_businesses b
       JOIN vis_campaign_businesses cb ON cb.business_id = b.id
       WHERE cb.id = ?`
    )
    .get(campaignBusinessId)) as { name: string } | undefined;
  return row?.name ?? `campaign business ${campaignBusinessId}`;
}

async function failJob(job: JobRow, message: string) {
  const payload = (() => {
    try {
      return JSON.parse(job.payload || "{}");
    } catch {
      return {};
    }
  })();
  const auditId = Number(payload.audit_id) || null;
  const campaignBusinessId = Number(payload.campaign_business_id) || null;

  if (job.attempts >= MAX_ATTEMPTS) {
    await db
      .prepare("UPDATE vis_jobs SET status='error', result=?, updated_at=now()::text WHERE id = ?")
      .run(message, job.id);
    if (job.type === "run_audit" && auditId) {
      await db
        .prepare("UPDATE vis_audits SET status='error', error=?, updated_at=now()::text WHERE id = ?")
        .run(message, auditId);
    }
    // A single business permanently failing shouldn't fail the whole audit —
    // just drop it and let the rest finish; still need to check finalization.
    if (job.type === "audit_business" && auditId) {
      await maybeFinalizeAudit(auditId);
    }
    if (job.type === "build_redesign" && campaignBusinessId) {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET redesign_status='error', redesign_error=?, updated_at=now()::text WHERE id = ?"
        )
        .run(message, campaignBusinessId);
    }
    if (job.type === "create_booking_link" && campaignBusinessId) {
      await db
        .prepare(
          "UPDATE vis_campaign_businesses SET booking_status='error', booking_error=?, updated_at=now()::text WHERE id = ?"
        )
        .run(message, campaignBusinessId);
    }
  } else {
    // Leave pending (not running) so the natural claim_job() path retries it.
    await db
      .prepare("UPDATE vis_jobs SET status='pending', result=?, updated_at=now()::text WHERE id = ?")
      .run(message, job.id);
  }
}

// Deliberately processes at most one job per invocation, not a loop. A
// single audit_business job (2 sequential Claude calls with web_search/
// web_fetch tool loops) can itself take up to ~3 minutes — a prior version
// that opportunistically started a second job whenever "budget" looked
// available got killed mid-flight by Vercel's hard function-duration limit
// when that first job had already used a large, unpredictable share of it.
// This isn't a loss of throughput: every fanned-out audit_business INSERT
// fires its own instant pg_net webhook (the trigger fires on any insert,
// regardless of which connection performed it), so concurrency comes from
// separate invocations, not from looping within one. The pg_cron backstop
// drains anything left pending/stale the same way.
export async function runWorkerLoop(): Promise<{ processed: number }> {
  const job = await claimJob();
  if (!job) return { processed: 0 };

  try {
    if (job.type === "run_audit") {
      await processRunAudit(job);
    } else if (job.type === "audit_business") {
      await processAuditBusiness(job);
    } else if (job.type === "build_redesign") {
      await processBuildRedesign(job);
    } else if (job.type === "create_booking_link") {
      await processCreateBookingLink(job);
    } else {
      await failJob(job, `Unknown job type: ${job.type}`);
      return { processed: 0 };
    }
    return { processed: 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failJob(job, message);
    return { processed: 0 };
  }
}
