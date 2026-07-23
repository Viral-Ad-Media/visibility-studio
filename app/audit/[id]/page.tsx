import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import db, { Audit, Business, PRIORITY_ORDER } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import BusinessTable from "@/components/BusinessTable";
import RequeueButton from "@/components/RequeueButton";
import AuditActions from "@/components/AuditActions";
import BackupToDriveButton from "@/components/BackupToDriveButton";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default async function AuditPage({ params }: { params: { id: string } }) {
  const audit = (await db
    .prepare("SELECT * FROM vis_audits WHERE id = ?")
    .get(Number(params.id))) as Audit | undefined;
  if (!audit) notFound();

  const businesses = (
    (await db
      .prepare("SELECT * FROM vis_businesses WHERE audit_id = ? ORDER BY id")
      .all(audit.id)) as Business[]
  ).sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority ?? ""] ?? 3) - (PRIORITY_ORDER[b.priority ?? ""] ?? 3) ||
      (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0)
  );

  const emailsFound = businesses.filter((b) => b.email && b.email !== "not found").length;
  const outreachCount = businesses.filter((b) => b.outreach_email).length;
  const inProgress = audit.status === "queued" || audit.status === "running";

  return (
    <div>
      {inProgress && <AutoRefresh />}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
            ← All audits
          </Link>
          <h1 className="text-2xl font-bold text-slate-100 mt-1">{audit.query}</h1>
          <div className="text-xs text-slate-500 mt-1">
            target {audit.target_count} businesses · created {audit.created_at.slice(0, 10)}
            {businesses.length > 0 && (
              <>
                {" "}· {businesses.length} audited · {emailsFound} emails found · {outreachCount}{" "}
                outreach drafts
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2.5 py-1 rounded-full border ${STATUS_STYLES[audit.status]}`}>
            {audit.status}
          </span>
          {businesses.length > 0 && (
            <a
              href={`/api/audits/${audit.id}/csv`}
              className="text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-1.5 rounded-lg"
            >
              Export CSV
            </a>
          )}
          {businesses.length > 0 && (
            <BackupToDriveButton
              auditId={audit.id}
              driveUrl={audit.csv_drive_url}
              backedUpAt={audit.csv_drive_backed_up_at}
            />
          )}
          {(audit.status === "error" || audit.status === "ready") && (
            <RequeueButton auditId={audit.id} />
          )}
          <AuditActions
            audit={{
              id: audit.id,
              category: audit.category,
              location: audit.location,
              target_count: audit.target_count,
              notes: audit.notes,
              status: audit.status,
            }}
          />
        </div>
      </div>

      {audit.notes && (
        <div className="text-sm text-slate-400 mt-3 card p-3">
          <span className="text-slate-500 text-xs">Notes for the engine: </span>
          {audit.notes}
        </div>
      )}

      {audit.status === "error" && audit.error && (
        <div className="mt-4 card border-red-500/30 p-4 text-sm text-red-400">{audit.error}</div>
      )}

      {inProgress && businesses.length === 0 && (
        <div className="mt-6 card p-10 text-center text-slate-400 text-sm">
          {audit.status === "queued" ? (
            <>
              Waiting for the engine — run <code className="text-sky-400">/run-audits</code> in
              Claude Code from this project folder.
            </>
          ) : (
            "The engine is researching businesses… results appear here as each audit lands."
          )}
        </div>
      )}

      {audit.summary_md && (
        <div className="mt-6 card p-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Engine summary
          </h2>
          <div
            className="markdown text-sm"
            dangerouslySetInnerHTML={{ __html: marked.parse(audit.summary_md) as string }}
          />
        </div>
      )}

      {businesses.length > 0 && (
        <div className="mt-6">
          <BusinessTable businesses={businesses} auditId={audit.id} />
        </div>
      )}
    </div>
  );
}
