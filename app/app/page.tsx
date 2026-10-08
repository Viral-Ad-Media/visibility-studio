import db, { getRequestAccount } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import WorkspaceOverview, { type WorkspaceSummary, type RecentAudit } from "@/components/WorkspaceOverview";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const { accountId } = await getRequestAccount();
  const account = await db.prepare("SELECT name FROM vis_accounts WHERE id = ?").get(accountId) as { name: string };
  const summary = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM vis_audits) AS audits,
    (SELECT COUNT(*) FROM vis_businesses) AS businesses,
    (SELECT COUNT(*) FROM vis_businesses WHERE priority='High') AS high_priority,
    (SELECT COUNT(*) FROM vis_businesses WHERE email IS NOT NULL AND trim(email) != '' AND email != 'not found') AS contacts,
    (SELECT COUNT(*) FROM vis_businesses WHERE outreach_email IS NOT NULL AND trim(outreach_email) != '') AS drafts,
    (SELECT COUNT(*) FROM vis_campaigns) AS campaigns,
    (SELECT COUNT(*) FROM vis_audits WHERE status IN ('queued','running')) AS active_audits,
    (SELECT COUNT(*) FROM vis_audits WHERE status='error') AS failed_audits,
    (SELECT COUNT(*) FROM vis_campaign_businesses WHERE stage='Selected') AS selected,
    (SELECT COUNT(*) FROM vis_campaign_businesses WHERE stage='Sent') AS sent,
    (SELECT COUNT(*) FROM vis_campaign_businesses WHERE stage='Replied') AS replied,
    (SELECT COUNT(*) FROM vis_campaign_businesses WHERE stage='Booked') AS booked,
    (SELECT COUNT(*) FROM vis_campaign_businesses WHERE stage='Won') AS won`).get() as WorkspaceSummary;
  const recent = await db.prepare("SELECT id, query, location, status FROM vis_audits ORDER BY id DESC LIMIT 5").all() as RecentAudit[];
  return <>{summary.active_audits > 0 && <AutoRefresh />}<WorkspaceOverview name={account.name || "Your workspace"} summary={summary} recent={recent} /></>;
}
