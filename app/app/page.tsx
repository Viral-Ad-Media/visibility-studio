import Link from "next/link";
import db, { Audit } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default async function Dashboard() {
  const audits = (await db
    .prepare("SELECT * FROM vis_audits ORDER BY id DESC")
    .all()) as Audit[];
  const counts = (await db
    .prepare(
      `SELECT audit_id,
              COUNT(*) AS total,
              SUM(CASE WHEN priority='High' THEN 1 ELSE 0 END) AS high,
              SUM(CASE WHEN email IS NOT NULL AND email != 'not found' THEN 1 ELSE 0 END) AS emails,
              SUM(CASE WHEN outreach_email IS NOT NULL THEN 1 ELSE 0 END) AS outreach
       FROM vis_businesses GROUP BY audit_id`
    )
    .all()) as { audit_id: number; total: number; high: number; emails: number; outreach: number }[];
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
       WHERE type IN ('run_audit','audit_business') AND result LIKE '{%'
       GROUP BY 1`
    )
    .all()) as { audit_id: number; cost: number }[];
  const costByAudit = new Map(costs.map((c) => [c.audit_id, Number(c.cost)]));

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audits</h1>
        <Link
          href="/app/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          New audit
        </Link>
      </div>

      {audits.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          No audits yet. Queue one and it runs automatically — no need to run anything yourself.
        </div>
      )}

      <div className="space-y-3">
        {audits.map((a) => {
          const c = byAudit.get(a.id);
          const cost = costByAudit.get(a.id);
          return (
            <Link key={a.id} href={`/app/audit/${a.id}`} className="card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors block">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100">{a.query}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {a.category} · {a.location} · target {a.target_count} businesses ·{" "}
                  {a.created_at.slice(0, 10)}
                </div>
                {a.status === "error" && a.error && (
                  <div className="text-xs text-red-400 mt-1 truncate">{a.error}</div>
                )}
              </div>
              {c && (
                <div className="text-xs text-slate-400 text-right shrink-0">
                  <div>
                    <span className="tabular text-slate-200 font-medium">{c.total}</span> businesses ·{" "}
                    <span className="tabular text-red-400 font-medium">{c.high}</span> high priority
                  </div>
                  <div className="mt-0.5 tabular">
                    {c.emails} emails · {c.outreach} outreach drafts
                  </div>
                </div>
              )}
              {!!cost && (
                <span
                  className="text-xs text-slate-500 tabular shrink-0"
                  title="Estimated Anthropic API cost"
                >
                  ~${cost.toFixed(2)}
                </span>
              )}
              <span
                className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${STATUS_STYLES[a.status]}`}
              >
                {a.status}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
