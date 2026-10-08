import Pagination from "@/components/Pagination";
import { PAGE_SIZE, pageNumber } from "@/lib/pagination";
import Link from "next/link";
import { SearchCheck } from "lucide-react";
import db, { Audit } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const q = (params.q || "").trim().slice(0, 200);
  const status = ["queued", "running", "ready", "error", "active"].includes(params.status || "") ? params.status! : "";
  const statuses = status === "active" ? ["queued", "running"] : status ? [status] : ["queued", "running", "ready", "error"];
  const offset = (page - 1) * PAGE_SIZE;
  const audits = (await db
    .prepare("SELECT * FROM vis_audits WHERE (query ILIKE ? OR location ILIKE ? OR category ILIKE ?) AND status = ANY(?) ORDER BY id DESC LIMIT 51 OFFSET ?")
    .all(`%${q}%`, `%${q}%`, `%${q}%`, statuses, offset)) as Audit[];
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audits</h1>
        <Link
          href="/app/new"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          New audit
        </Link>
      </div>

      <form method="get" className="card p-4 mb-5 flex flex-wrap gap-3">
        <input name="q" aria-label="Search audits" defaultValue={q} placeholder="Search niche, location, or audit…" maxLength={200} className="min-w-0 flex-1 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm" />
        <select name="status" aria-label="Audit status" defaultValue={status} className="rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm"><option value="">All statuses</option><option value="active">In progress</option><option value="queued">Queued</option><option value="running">Running</option><option value="ready">Ready</option><option value="error">Failed</option></select>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">Search</button>
        {(q || status) && <Link href="/app/audits" className="p-2 text-sm text-slate-400">Clear</Link>}
      </form>
      {audits.length === 0 && (
        <div className="card p-10 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
            <SearchCheck className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1.5">
            {q || status || page > 1 ? "No matching audits" : "No audits yet"}
          </h2>
          <p className="mx-auto max-w-sm text-sm text-slate-400 mb-5">
            Queue one with a niche and a location — it finds real local
            businesses and audits each one automatically. Try &ldquo;dentists in
            Dallas&rdquo; or &ldquo;roofing companies in Atlanta&rdquo;.
          </p>
          <Link
            href="/app/new"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <SearchCheck className="w-3.5 h-3.5" />
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
              className="card p-5 flex flex-wrap items-center gap-4 hover:border-ink-600 transition-colors block"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-100">{a.query}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {a.category} · {a.location} · target {a.target_count}{" "}
                  businesses · {a.created_at.slice(0, 10)}
                </div>
                {a.status === "error" && a.error && (
                  <div className="text-xs text-red-400 mt-1 truncate">
                    {a.error}
                  </div>
                )}
              </div>
              {c && (
                <div className="text-xs text-slate-400 text-right shrink-0">
                  <div>
                    <span className="tabular text-slate-200 font-medium">
                      {c.total}
                    </span>{" "}
                    businesses ·{" "}
                    <span className="tabular text-red-400 font-medium">
                      {c.high}
                    </span>{" "}
                    high priority
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
      <Pagination page={page} hasMore={hasMore} path="/app/audits" query={{ q, status }} />
    </div>
  );
}
