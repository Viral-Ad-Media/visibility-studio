import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import db, { Audit, Business, PRIORITY_ORDER } from "@/lib/db";
import AutoRefresh from "@/components/AutoRefresh";
import BusinessTable from "@/components/BusinessTable";
import RequeueButton from "@/components/RequeueButton";
import AuditActions from "@/components/AuditActions";
import StatusBadge from "@/components/StatusBadge";
import { ArrowLeft, Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// summary_md interpolates business names the engine scraped from third-party
// sites, and marked passes raw HTML straight through — escape it first so a
// business name can never inject markup or a [link](javascript:...). The
// templated summary (see buildSummary in lib/engine/worker.ts) uses no HTML,
// links, or images, only bold/headings/lists.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;");
}

export const dynamic = "force-dynamic";


export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const audit = (await db
    .prepare("SELECT * FROM vis_audits WHERE id = ?")
    .get(Number((await params).id))) as Audit | undefined;
  if (!audit) notFound();

  const businesses = (
    (await db
      .prepare("SELECT * FROM vis_businesses WHERE audit_id = ? ORDER BY id")
      .all(audit.id)) as Business[]
  ).sort(
    (a, b) =>
      (PRIORITY_ORDER[a.priority ?? ""] ?? 3) -
        (PRIORITY_ORDER[b.priority ?? ""] ?? 3) ||
      (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0),
  );

  const emailsFound = businesses.filter(
    (b) => b.email && b.email !== "not found",
  ).length;
  const outreachCount = businesses.filter((b) => b.outreach_email).length;
  const inProgress = audit.status === "queued" || audit.status === "running";

  return (
    <div>
      {inProgress && <AutoRefresh />}
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All audits
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mt-1 mb-1">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-100">
            {audit.query}
          </h1>
          <div className="text-xs text-slate-500 mt-1">
            target {audit.target_count} businesses · created{" "}
            {audit.created_at.slice(0, 10)}
            {businesses.length > 0 && (
              <>
                {" "}
                · {businesses.length} audited · {emailsFound} emails found ·{" "}
                {outreachCount} outreach drafts
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge status={audit.status} />
          {businesses.length > 0 && (
            <a
              href={`/api/audits/${audit.id}/csv`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download />
              Export CSV
            </a>
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
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {audit.error}
        </div>
      )}

      {inProgress && businesses.length === 0 && (
        <div
          role="status"
          className="mt-6 card p-10 text-center text-slate-400 text-sm"
        >
          {audit.status === "queued"
            ? "Waiting for the engine to pick this up — starts automatically, usually within a minute."
            : "The engine is researching businesses… results appear here as each audit lands."}
        </div>
      )}

      {audit.summary_md && (
        <div className="mt-6 card p-6">
          <h2 className="text-base font-semibold text-slate-100 mb-2">
            Engine summary
          </h2>
          <div
            className="markdown text-sm"
            dangerouslySetInnerHTML={{
              __html: marked.parse(escapeHtml(audit.summary_md)) as string,
            }}
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
