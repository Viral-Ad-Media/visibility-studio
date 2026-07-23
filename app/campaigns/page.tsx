import Link from "next/link";
import db, { Campaign } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

type Row = Campaign & {
  audit_query: string;
  total: number;
  redesigns_ready: number;
  links_ready: number;
  sent: number;
  replied: number;
  booked: number;
  won: number;
  in_flight: number;
};

export default function CampaignsPage() {
  const campaigns = db
    .prepare(
      `SELECT c.*, a.query AS audit_query,
              COUNT(cb.id) AS total,
              SUM(CASE WHEN cb.redesign_status='ready' THEN 1 ELSE 0 END) AS redesigns_ready,
              SUM(CASE WHEN cb.booking_status='ready' THEN 1 ELSE 0 END) AS links_ready,
              SUM(CASE WHEN cb.stage='Sent' THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN cb.stage='Replied' THEN 1 ELSE 0 END) AS replied,
              SUM(CASE WHEN cb.stage='Booked' THEN 1 ELSE 0 END) AS booked,
              SUM(CASE WHEN cb.stage='Won' THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN cb.redesign_status IN ('pending','running') OR cb.booking_status IN ('pending','running') THEN 1 ELSE 0 END) AS in_flight
       FROM campaigns c
       LEFT JOIN campaign_businesses cb ON cb.campaign_id = c.id
       LEFT JOIN audits a ON a.id = c.audit_id
       GROUP BY c.id
       ORDER BY c.id DESC`
    )
    .all() as Row[];

  const anyInFlight = campaigns.some((c) => c.in_flight > 0);

  return (
    <div>
      {anyInFlight && <AutoRefresh />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Campaigns</h1>
      </div>

      {campaigns.length === 0 && (
        <div className="card p-10 text-center text-slate-400">
          No campaigns yet. Select businesses on an audit page and click{" "}
          <span className="text-slate-200">Create campaign</span>.
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/campaigns/${c.id}`}
            className="card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors block"
          >
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                from &ldquo;{c.audit_query}&rdquo; · {c.total} businesses ·{" "}
                {c.created_at.slice(0, 10)}
              </div>
            </div>
            <div className="text-xs text-slate-400 text-right shrink-0">
              <div>
                <span className="text-slate-200 font-medium">{c.redesigns_ready}</span>/{c.total}{" "}
                mockups ·{" "}
                <span className="text-slate-200 font-medium">{c.links_ready}</span>/{c.total} links
                ready
              </div>
              <div className="mt-0.5">
                {c.sent} sent · {c.replied} replied ·{" "}
                <span className="text-emerald-400">{c.booked} booked</span> ·{" "}
                <span className="text-emerald-400">{c.won} won</span>
              </div>
            </div>
            {c.in_flight > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full border shrink-0 bg-sky-500/10 text-sky-400 border-sky-500/30">
                generating
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
