import Link from "next/link";
import { notFound } from "next/navigation";
import db, { Campaign, CampaignBusinessRow } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import CampaignBusinessTable from "@/components/CampaignBusinessTable";
import DeleteCampaignButton from "@/components/DeleteCampaignButton";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const campaign = (await db
    .prepare("SELECT * FROM vis_campaigns WHERE id = ?")
    .get(Number(params.id))) as Campaign | undefined;
  if (!campaign) notFound();

  const audit = (await db
    .prepare("SELECT id, query FROM vis_audits WHERE id = ?")
    .get(campaign.audit_id)) as { id: number; query: string } | undefined;

  const rows = (await db
    .prepare(
      `SELECT cb.id, cb.campaign_id, cb.business_id, cb.stage,
              cb.redesign_status, cb.redesign_error, cb.redesign_drive_url,
              cb.booking_status, cb.booking_link, cb.booking_event_type, cb.booking_error,
              cb.created_at, cb.updated_at,
              b.name, b.category, b.location, b.website, b.maps_url, b.phone, b.email,
              b.priority, b.outreach_subject, b.outreach_email
       FROM vis_campaign_businesses cb
       JOIN vis_businesses b ON b.id = cb.business_id
       WHERE cb.campaign_id = ?
       ORDER BY cb.id`
    )
    .all(campaign.id)) as CampaignBusinessRow[];

  const inFlight = rows.some(
    (r) =>
      r.redesign_status === "pending" ||
      r.redesign_status === "running" ||
      r.booking_status === "pending" ||
      r.booking_status === "running"
  );

  return (
    <div>
      {inFlight && <AutoRefresh />}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <Link href="/app/campaigns" className="text-xs text-slate-500 hover:text-slate-300">
            ← All campaigns
          </Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">{campaign.name}</h1>
          <div className="text-xs text-slate-500 mt-1">
            {audit && (
              <>
                from{" "}
                <Link href={`/app/audit/${audit.id}`} className="hover:text-slate-300">
                  &ldquo;{audit.query}&rdquo;
                </Link>{" "}
                ·{" "}
              </>
            )}
            {rows.length} businesses · created {campaign.created_at.slice(0, 10)}
          </div>
        </div>
        <DeleteCampaignButton campaignId={campaign.id} />
      </div>

      {inFlight && (
        <div className="mt-4 card p-3 text-sm text-slate-400">
          The engine is generating redesign mockups and booking links — run{" "}
          <code className="text-indigo-400">/run-campaigns</code> in Claude Code if it isn&apos;t
          already running.
        </div>
      )}

      <div className="mt-6">
        <CampaignBusinessTable rows={rows} />
      </div>
    </div>
  );
}
