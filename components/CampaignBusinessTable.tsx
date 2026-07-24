"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  RotateCw,
  Loader2,
} from "lucide-react";
import type { CampaignBusinessRow } from "@/lib/shared";
import { CAMPAIGN_STAGES } from "@/lib/shared";
import StatusSelect from "@/components/StatusSelect";

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-500/10 text-red-400 border-red-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Low: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

const JOB_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  running: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  ready: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  error: "bg-red-500/10 text-red-400 border-red-500/30",
};

function JobBadge({ label, status }: { label: string; status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${JOB_STATUS_STYLES[status]}`}
    >
      {status === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
      {label}: {status}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function RequeueButton({
  campaignBusinessId,
  type,
  label,
}: {
  campaignBusinessId: number;
  type: "build_redesign" | "create_booking_link";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/campaign-businesses/${campaignBusinessId}/requeue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });
        setBusy(false);
        router.refresh();
      }}
      className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
    >
      <RotateCw className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function Row({ r }: { r: CampaignBusinessRow }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function setStage(stage: string) {
    setSaving(true);
    await fetch(`/api/campaign-businesses/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setSaving(false);
    router.refresh();
  }

  const hasEmail = r.email && r.email !== "not found";
  const readyToSendEmail =
    r.outreach_email &&
    (r.outreach_subject ? `Subject: ${r.outreach_subject}\n\n` : "") +
      r.outreach_email +
      (r.booking_status === "ready" && r.booking_link
        ? `\n\nPick a time that works: ${r.booking_link}`
        : "");

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-ink-800/50"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-100 truncate">{r.name}</div>
          <div className="text-xs text-slate-500 truncate">
            {[r.category, r.location].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <JobBadge label="Mockup" status={r.redesign_status} />
          <JobBadge label="Link" status={r.booking_status} />
        </div>
        {r.priority && (
          <span
            className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${PRIORITY_STYLES[r.priority]}`}
          >
            {r.priority}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-ink-700 p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {r.website && (
              <a
                href={r.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Live site
              </a>
            )}
            {r.maps_url && (
              <a
                href={r.maps_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Maps
              </a>
            )}
            {hasEmail && <CopyButton text={r.email!} label="Copy email" />}
            {r.phone && <span className="text-xs text-slate-400">{r.phone}</span>}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Stage</span>
              <StatusSelect
                value={r.stage}
                options={CAMPAIGN_STAGES}
                disabled={saving}
                onChange={setStage}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-ink-950 border border-ink-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
                  Redesign mockup
                </div>
                <JobBadge label="Mockup" status={r.redesign_status} />
              </div>
              {r.redesign_status === "ready" && (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`/api/campaign-businesses/${r.id}/redesign`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg w-fit"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View mockup
                  </a>
                  {r.redesign_drive_url && (
                    <a
                      href={r.redesign_drive_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg w-fit"
                      title="Drive backup of the mockup HTML — opens as a downloadable file, not a rendered page"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Drive backup
                    </a>
                  )}
                </div>
              )}
              {r.redesign_status === "error" && r.redesign_error && (
                <div className="text-xs text-red-400">{r.redesign_error}</div>
              )}
              {(r.redesign_status === "error" || r.redesign_status === "ready") && (
                <RequeueButton
                  campaignBusinessId={r.id}
                  type="build_redesign"
                  label={r.redesign_status === "error" ? "Retry" : "Regenerate"}
                />
              )}
            </div>

            <div className="bg-ink-950 border border-ink-700 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
                  Booking link
                </div>
                <JobBadge label="Link" status={r.booking_status} />
              </div>
              {r.booking_status === "ready" && r.booking_link && (
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={r.booking_link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-400 hover:underline truncate"
                  >
                    {r.booking_link}
                  </a>
                  <CopyButton text={r.booking_link} label="Copy link" />
                </div>
              )}
              {r.booking_event_type && (
                <div className="text-[11px] text-slate-500">
                  Event type: {r.booking_event_type}
                </div>
              )}
              {r.booking_status === "error" && r.booking_error && (
                <div className="text-xs text-red-400">{r.booking_error}</div>
              )}
              {(r.booking_status === "error" || r.booking_status === "ready") && (
                <RequeueButton
                  campaignBusinessId={r.id}
                  type="create_booking_link"
                  label={r.booking_status === "error" ? "Retry" : "Regenerate"}
                />
              )}
            </div>
          </div>

          {readyToSendEmail && (
            <div className="bg-ink-950 border border-ink-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">
                  Ready-to-send email
                  {r.booking_status !== "ready" && (
                    <span className="text-slate-500 normal-case font-normal">
                      {" "}
                      (booking link not ready yet — will be appended once generated)
                    </span>
                  )}
                </div>
                <CopyButton text={readyToSendEmail} label="Copy email" />
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">{readyToSendEmail}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CampaignBusinessTable({ rows }: { rows: CampaignBusinessRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Row key={r.id} r={r} />
      ))}
    </div>
  );
}
