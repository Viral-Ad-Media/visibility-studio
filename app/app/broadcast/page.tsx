import { Send } from "lucide-react";
import db, { Contact } from "@/lib/db";
import BroadcastQueue from "@/components/BroadcastQueue";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  // Same shape as Contacts, narrowed to businesses with an actual drafted
  // outreach email — those are the only ones there's anything to send.
  const contacts = (await db
    .prepare(
      `SELECT DISTINCT ON (b.id)
              b.id, b.name, b.email, b.phone, b.category, b.location, b.website,
              b.priority, b.crm_status, b.outreach_subject, b.outreach_email,
              b.audit_id, a.query AS audit_query, b.created_at,
              cb.campaign_id, c.name AS campaign_name, cb.stage AS campaign_stage
       FROM vis_businesses b
       JOIN vis_audits a ON a.id = b.audit_id
       LEFT JOIN vis_campaign_businesses cb ON cb.business_id = b.id
       LEFT JOIN vis_campaigns c ON c.id = cb.campaign_id
       WHERE b.email IS NOT NULL AND b.email != 'not found'
         AND b.outreach_email IS NOT NULL
       ORDER BY b.id DESC, cb.id DESC`
    )
    .all()) as Contact[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Broadcast</h1>
          <p className="text-sm text-slate-500 mt-1">
            Bulk outreach queue — select contacts with a drafted email, then copy or open each
            one in your own mail client. Sending always stays a manual, human step.
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="card p-10 text-center animate-fade-in-up">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-ink-700 bg-ink-800">
            <Send className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-100 mb-1.5">Nothing to broadcast yet</h2>
          <p className="mx-auto max-w-sm text-sm text-slate-400">
            Contacts show up here once an audit drafts a personalized outreach email for them.
          </p>
        </div>
      ) : (
        <BroadcastQueue contacts={contacts} />
      )}
    </div>
  );
}
