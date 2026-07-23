import Link from "next/link";
import db, { Audit } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-sky-500/10 text-sky-400 border-sky-500/30",
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

  return (
    <div>
      <AutoRefresh />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Audits</h1>
        <Link
          href="/new"
          className="bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          New audit
        </Link>
      </div>

      {audits.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          No audits yet. Queue one, then run <code className="text-sky-400">/run-audits</code> in
          Claude Code to execute it.
        </div>
      )}

      <div className="space-y-3">
        {audits.map((a) => {
          const c = byAudit.get(a.id);
          return (
            <Link key={a.id} href={`/audit/${a.id}`} className="card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors block">
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
                    <span className="text-slate-200 font-medium">{c.total}</span> businesses ·{" "}
                    <span className="text-red-400 font-medium">{c.high}</span> high priority
                  </div>
                  <div className="mt-0.5">
                    {c.emails} emails · {c.outreach} outreach drafts
                  </div>
                </div>
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
