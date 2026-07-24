import NewAuditForm from "@/components/NewAuditForm";

export default function NewAuditPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">New visibility audit</h1>
      <p className="text-sm text-slate-400 mb-6">
        Queue a niche + location. Claude Code finds the businesses, audits each website, scores the
        opportunity, scrapes public contact emails, and drafts personalized outreach.
      </p>
      <NewAuditForm />
    </div>
  );
}
