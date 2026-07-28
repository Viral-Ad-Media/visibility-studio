import { serviceDb as db } from "../db";
import { PRIORITY_ORDER, type Business } from "../shared";
import { discoverCandidates } from "./discover";
import { runAuditBusiness } from "./auditBusiness";

const INVOCATION_BUDGET_MS = 50_000; // stay safely under maxDuration=60
const MAX_ATTEMPTS = 5;

type JobRow = {
  id: number;
  type: "run_audit" | "audit_business" | string;
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
  await db
    .prepare(
      "UPDATE vis_audits SET status='ready', error=NULL, summary_md=?, updated_at=now()::text WHERE id = ? AND status <> 'ready'"
    )
    .run(summary, auditId);
}

async function processRunAudit(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const auditId = Number(payload.audit_id);
  if (!auditId) throw new Error(`run_audit job ${job.id} has no audit_id in its payload`);

  await db
    .prepare("UPDATE vis_audits SET status='running', error=NULL, updated_at=now()::text WHERE id = ?")
    .run(auditId);

  const { candidates, searchCallCount } = await discoverCandidates(auditId);

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

  await markDone(job.id, JSON.stringify({ search_call_count: searchCallCount, candidates: candidates.length }));
}

async function processAuditBusiness(job: JobRow) {
  const payload = JSON.parse(job.payload || "{}");
  const auditId = Number(payload.audit_id);
  if (!auditId) throw new Error(`audit_business job ${job.id} has no audit_id in its payload`);

  const { businessId, created, searchCallCount } = await runAuditBusiness({
    audit_id: auditId,
    name: payload.name,
    website: payload.website ?? null,
  });

  await markDone(job.id, JSON.stringify({ business_id: businessId, created, search_call_count: searchCallCount }));
  await maybeFinalizeAudit(auditId);
}

async function failJob(job: JobRow, message: string) {
  const auditId = (() => {
    try {
      return Number(JSON.parse(job.payload || "{}").audit_id) || null;
    } catch {
      return null;
    }
  })();

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
  } else {
    // Leave pending (not running) so the natural claim_job() path retries it.
    await db
      .prepare("UPDATE vis_jobs SET status='pending', result=?, updated_at=now()::text WHERE id = ?")
      .run(message, job.id);
  }
}

export async function runWorkerLoop(): Promise<{ processed: number }> {
  const start = Date.now();
  let processed = 0;

  while (Date.now() - start < INVOCATION_BUDGET_MS) {
    const job = await claimJob();
    if (!job) break;

    try {
      if (job.type === "run_audit") {
        await processRunAudit(job);
      } else if (job.type === "audit_business") {
        await processAuditBusiness(job);
      } else {
        await failJob(job, `Unknown job type: ${job.type}`);
        continue;
      }
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await failJob(job, message);
    }
  }

  return { processed };
}
