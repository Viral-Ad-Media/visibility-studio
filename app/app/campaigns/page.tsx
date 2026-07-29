import Link from "next/link";
import { Megaphone } from "lucide-react";
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

export default async function CampaignsPage() {
  const campaigns = (await db
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
       FROM vis_campaigns c
       LEFT JOIN vis_campaign_businesses cb ON cb.campaign_id = c.id
       LEFT JOIN vis_audits a ON a.id = c.audit_id
       GROUP BY c.id, a.query
       ORDER BY c.id DESC`
    )
    .all()) as Row[];

  // Estimated cost, summed from each campaign's build_redesign +
  // create_booking_link jobs (lib/engine/worker.ts writes estimated_cost_usd
  // into result on completion). Filtered to JSON-shaped results only — a job
  // can fail with a plain-string message instead, which would blow up the
  // ::json cast.
  const costs = (await db
    .prepare(
      `SELECT (payload::json->>'campaign_id')::bigint AS campaign_id,
              SUM(COALESCE((result::json->>'estimated_cost_usd')::numeric, 0)) AS cost
       FROM vis_jobs
       WHERE type IN ('build_redesign','create_booking_link') AND result LIKE '{%'
       GROUP BY 1`
    )
    .all()) as { campaign_id: number; cost: number }[];
  const costByCampaign = new Map(costs.map((c) => [c.campaign_id, Number(c.cost)]));

  const anyInFlight = campaigns.some((c) => c.in_flight > 0);

  return (
    <div>
      {anyInFlight && <AutoRefresh />}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Campaigns</h1>
      </div>

      {campaigns.length === 0 && (
        <div className="card p-10 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
            <Megaphone className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1.5">No campaigns yet</h2>
          <p className="mx-auto max-w-sm text-sm text-slate-400 mb-5">
            Open a ready audit, select the businesses worth pursuing, and click{" "}
            <span className="text-slate-200">Create campaign</span> — each one gets a homepage
            redesign mockup and a real booking link.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            <Megaphone className="w-3.5 h-3.5" />
            Go to your audits
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            href={`/app/campaigns/${c.id}`}
            className="card p-5 flex items-center gap-4 hover:border-ink-600 transition-colors block"
          >
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-slate-100">{c.name}</div>
              <div className="text-xs text-slate-500 mt-1">
                from &ldquo;{c.audit_query}&rdquo; · {c.total} businesses ·{" "}
                {c.created_at.slice(0, 10)}
              </div>
            </div>
            <div className="text-xs text-slate-400 text-right shrink-0 tabular">
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
            {!!costByCampaign.get(c.id) && (
              <span
                className="text-xs text-slate-500 tabular shrink-0"
                title="Estimated Anthropic API cost"
              >
                ~${costByCampaign.get(c.id)!.toFixed(2)}
              </span>
            )}
            {c.in_flight > 0 && (
              <span className="text-xs px-2.5 py-1 rounded-full border shrink-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                generating
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
