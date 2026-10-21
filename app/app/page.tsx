import Pagination from "@/components/Pagination";
import { PAGE_SIZE, pageNumber } from "@/lib/pagination";
import Link from "next/link";
import { SearchCheck } from "lucide-react";
import db, { Audit } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import StatusBadge from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";


export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = pageNumber((await searchParams).page);
  const offset = (page - 1) * PAGE_SIZE;
  const audits = (await db
    .prepare("SELECT * FROM vis_audits ORDER BY id DESC LIMIT 51 OFFSET ?")
    .all(offset)) as Audit[];
  const hasMore = audits.length > PAGE_SIZE;
  audits.splice(PAGE_SIZE);
  const counts = (await db
    .prepare(
      `SELECT audit_id,
              COUNT(*) AS total,
              SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) AS high,
              SUM(CASE WHEN email IS NOT NULL AND email != 'not found' THEN 1 ELSE 0 END) AS emails,
              SUM(CASE WHEN outreach_email IS NOT NULL THEN 1 ELSE 0 END) AS outreach
       FROM vis_businesses WHERE audit_id = ANY(?) GROUP BY audit_id`,
    )
    .all([audits.map((a) => a.id)])) as {
    audit_id: number;
    total: number;
    high: number;
    emails: number;
    outreach: number;
  }[];
  const byAudit = new Map(counts.map((c) => [c.audit_id, c]));

  // Estimated cost, summed from each audit's run_audit + audit_business jobs
  // (lib/engine/worker.ts writes estimated_cost_usd into result on completion).
  // Filtered to JSON-shaped results only — a job can fail with a plain-string
  // message instead, which would blow up the ::json cast.
  const costs = (await db
    .prepare(
      `SELECT (payload::json->>'audit_id')::bigint AS audit_id,
              SUM(COALESCE((result::json->>'estimated_cost_usd')::numeric, 0)) AS cost
       FROM vis_jobs
       WHERE type IN ('run_audit','audit_business') AND result LIKE '{%' AND (payload::json->>'audit_id')::bigint = ANY(?)
       GROUP BY 1`,
    )
    .all([audits.map((a) => a.id)])) as { audit_id: number; cost: number }[];
  const costByAudit = new Map(costs.map((c) => [c.audit_id, Number(c.cost)]));

  return (
    <div>
      {audits.some((a) => ["queued", "running"].includes(a.status)) && (
        <AutoRefresh />
      )}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audits</h1>
        <Link href="/app/new" className={buttonVariants()}>
          <SearchCheck />
          New audit
        </Link>
      </div>

      {audits.length === 0 && (
        <div className="card p-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
            <SearchCheck className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="text-base font-semibold text-slate-100 mb-1.5">
            No audits yet
          </h2>
          <p className="mx-auto max-w-sm text-sm text-slate-400 mb-5">
            Queue one with a niche and a location — it finds real local
            businesses and audits each one automatically. Try &ldquo;dentists in
            Dallas&rdquo; or &ldquo;roofing companies in Atlanta&rdquo;.
          </p>
          <Link href="/app/new" className={buttonVariants()}>
            <SearchCheck />
            Queue your first audit
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {audits.map((a) => {
          const c = byAudit.get(a.id);
          const cost = costByAudit.get(a.id);
          return (
            <Link
              key={a.id}
              href={`/app/audit/${a.id}`}
              className="card p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 hover:border-ink-600 hover:bg-ink-800/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold text-slate-100 min-w-0">
                    {a.query}
                  </div>
                  <StatusBadge status={a.status} className="sm:hidden" />
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {a.category} · {a.location} · target {a.target_count}{" "}
                  businesses · {a.created_at.slice(0, 10)}
                </div>
                {a.status === "error" && a.error && (
                  <div className="text-xs text-red-400 mt-1 line-clamp-2">
                    {a.error}
                  </div>
                )}
              </div>
              {c && (
                <dl className="flex gap-4 text-xs text-slate-500 sm:text-right shrink-0">
                  <div className="flex flex-col-reverse">
                    <dt>businesses</dt>
                    <dd className="tabular text-sm font-semibold text-slate-200">
                      {c.total}
                    </dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt>high priority</dt>
                    <dd className="tabular text-sm font-semibold text-red-400">
                      {c.high}
                    </dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt>emails</dt>
                    <dd className="tabular text-sm font-semibold text-slate-200">
                      {c.emails}
                    </dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt>drafts</dt>
                    <dd className="tabular text-sm font-semibold text-slate-200">
                      {c.outreach}
                    </dd>
                  </div>
                </dl>
              )}
              {!!cost && (
                <span
                  className="text-xs text-slate-500 tabular shrink-0"
                  title="Estimated Anthropic API cost"
                >
                  ~${cost.toFixed(2)}
                </span>
              )}
              <StatusBadge status={a.status} className="hidden sm:inline-flex" />
            </Link>
          );
        })}
      </div>
      <Pagination page={page} hasMore={hasMore} path="/app" />
    </div>
  );
}
