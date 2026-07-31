"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Mail, ChevronDown, ChevronRight, X } from "lucide-react";
import type { Contact } from "@/lib/shared";

function draftText(c: Contact): string {
  return (c.outreach_subject ? `Subject: ${c.outreach_subject}\n\n` : "") + c.outreach_email;
}

function mailtoHref(c: Contact): string {
  const subject = encodeURIComponent(c.outreach_subject ?? `Following up — ${c.name}`);
  const body = encodeURIComponent(c.outreach_email ?? "");
  return `mailto:${encodeURIComponent(c.email)}?subject=${subject}&body=${body}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
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
  c,
  selected,
  onToggle,
}: {
  c: Contact;
  selected: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card overflow-hidden">
      <div className="w-full flex items-center gap-3 p-4 hover:bg-ink-800/50">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0"
        />
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-medium text-slate-100 truncate">{c.name}</div>
            <div className="text-xs text-slate-500 truncate">
              {c.email} {c.outreach_subject ? `· ${c.outreach_subject}` : ""}
            </div>
          </div>
        </button>
        <a
          href={mailtoHref(c)}
          className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-2.5 py-1.5 rounded-lg shrink-0"
        >
          <Mail className="w-3.5 h-3.5" /> Open in mail
        </a>
        <CopyButton text={draftText(c)} label="Copy" />
      </div>
      {open && (
        <div className="border-t border-ink-700 p-4 bg-ink-950">
          <div className="text-sm text-slate-300 whitespace-pre-wrap">{c.outreach_email}</div>
        </div>
      )}
    </div>
  );
}

export default function EmailQueue({ contacts }: { contacts: Contact[] }) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === contacts.length ? new Set() : new Set(contacts.map((c) => c.id))));
  }

  const selectedContacts = useMemo(
    () => contacts.filter((c) => selected.has(c.id)),
    [contacts, selected]
  );

  const combinedDraft = useMemo(
    () =>
      selectedContacts
        .map((c) => `To: ${c.email}\n${draftText(c)}`)
        .join("\n\n" + "-".repeat(40) + "\n\n"),
    [selectedContacts]
  );

  async function markContacted() {
    setBusy(true);
    await fetch("/api/businesses/bulk-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), crm_status: "Contacted" }),
    });
    setBusy(false);
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <input
          type="checkbox"
          checked={selected.size > 0 && selected.size === contacts.length}
          onChange={toggleAll}
          className="w-4 h-4 rounded border-ink-600 bg-ink-800 text-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">
          Select all {contacts.length} draft{contacts.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="space-y-2 pb-24">
        {contacts.map((c) => (
          <Row key={c.id} c={c} selected={selected.has(c.id)} onToggle={() => toggle(c.id)} />
        ))}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 card px-5 py-3 flex items-center gap-3 shadow-xl border-indigo-600/40">
          <span className="text-sm text-slate-200">
            <span className="font-semibold text-indigo-400">{selected.size}</span> selected
          </span>
          <CopyButton text={combinedDraft} label={`Copy all ${selected.size}`} />
          <button
            disabled={busy}
            onClick={markContacted}
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            Mark as Contacted
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-500 hover:text-slate-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
