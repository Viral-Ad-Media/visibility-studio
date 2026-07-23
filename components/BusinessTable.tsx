"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import type { Business } from "@/lib/shared";
import { CRM_STATUSES } from "@/lib/shared";
import StatusSelect from "@/components/StatusSelect";
import CreateCampaignBar from "@/components/CreateCampaignBar";

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-500/10 text-red-400 border-red-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Low: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

function Score({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="text-center">
      <div
        className={`text-lg font-bold ${
          value == null
            ? "text-slate-600"
            : value >= 4
            ? "text-emerald-400"
            : value >= 3
            ? "text-amber-400"
            : "text-red-400"
        }`}
      >
        {value ?? "–"}
      </div>
      <div className="text-[10px] text-slate-500 leading-tight">{label}</div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {title}
      </div>
      <div className="text-sm text-slate-300 whitespace-pre-wrap">{text}</div>
    </div>
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

function Row({
  b,
  selected,
  onToggle,
}: {
  b: Business;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function setStatus(status: string) {
    setSaving(true);
    await fetch(`/api/businesses/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crm_status: status }),
    });
    setSaving(false);
    router.refresh();
  }

  const hasEmail = b.email && b.email !== "not found";

  return (
    <div className="card overflow-hidden">
      <div className="w-full flex items-center gap-3 p-4 hover:bg-ink-800/50">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 shrink-0"
          aria-label={`Select ${b.name}`}
        />
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-3 text-left min-w-0"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-100 truncate">{b.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {b.website ?? "no website"}
              {b.rating && ` · ★ ${b.rating}${b.review_count ? ` (${b.review_count})` : ""}`}
              {hasEmail && ` · ${b.email}`}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4 shrink-0">
            <Score label="SEO" value={b.seo_score} />
            <Score label="Conv" value={b.conversion_score} />
            <Score label="Trust" value={b.trust_score} />
            <Score label="Opp" value={b.opportunity_score} />
          </div>
          {b.priority && (
            <span
              className={`text-xs px-2.5 py-1 rounded-full border shrink-0 ${PRIORITY_STYLES[b.priority]}`}
            >
              {b.priority}
            </span>
          )}
          <span className="text-xs text-slate-500 shrink-0 w-20 text-right">{b.crm_status}</span>
        </button>
      </div>

      {open && (
        <div className="border-t border-ink-700 p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {b.website && (
              <a
                href={b.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Website
              </a>
            )}
            {b.maps_url && (
              <a
                href={b.maps_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Maps
              </a>
            )}
            {hasEmail && <CopyButton text={b.email!} label="Copy email" />}
            {b.phone && <span className="text-xs text-slate-400">{b.phone}</span>}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Status</span>
              <StatusSelect
                value={b.crm_status}
                options={CRM_STATUSES}
                disabled={saving}
                onChange={setStatus}
              />
            </div>
          </div>

          {(b.homepage_headline || b.main_cta) && (
            <div className="text-sm text-slate-400">
              {b.homepage_headline && (
                <>
                  <span className="text-slate-500 text-xs">Headline: </span>
                  <span className="italic">“{b.homepage_headline}”</span>
                </>
              )}
              {b.main_cta && (
                <>
                  {b.homepage_headline && " · "}
                  <span className="text-slate-500 text-xs">Main CTA: </span>
                  {b.main_cta}
                </>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-5">
            <Section title="Visibility issues" text={b.visibility_issues} />
            <Section title="Website improvements" text={b.website_improvements} />
            <Section title="Local SEO opportunities" text={b.local_seo_opportunities} />
            <Section title="Content opportunities" text={b.content_opportunities} />
          </div>

          {b.outreach_email && (
            <div className="bg-ink-950 border border-ink-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wide">
                  Outreach draft{b.outreach_subject ? ` — ${b.outreach_subject}` : ""}
                </div>
                <CopyButton
                  text={
                    b.outreach_subject
                      ? `Subject: ${b.outreach_subject}\n\n${b.outreach_email}`
                      : b.outreach_email
                  }
                  label="Copy outreach"
                />
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">{b.outreach_email}</div>
            </div>
          )}

          {b.outreach_angle && <Section title="Outreach angle" text={b.outreach_angle} />}
          {b.audit_notes && <Section title="Notes" text={b.audit_notes} />}
        </div>
      )}
    </div>
  );
}

export default function BusinessTable({
  businesses,
  auditId,
}: {
  businesses: Business[];
  auditId: number;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2 pb-16">
      {businesses.map((b) => (
        <Row key={b.id} b={b} selected={selected.has(b.id)} onToggle={() => toggle(b.id)} />
      ))}
      <CreateCampaignBar
        auditId={auditId}
        selectedIds={Array.from(selected)}
        onCreated={() => setSelected(new Set())}
      />
    </div>
  );
}
