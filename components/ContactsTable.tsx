"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Download, Search } from "lucide-react";
import type { Contact } from "@/lib/shared";
import { CRM_STATUSES } from "@/lib/shared";
import StatusSelect from "@/components/StatusSelect";

const PRIORITY_STYLES: Record<string, string> = {
  High: "bg-red-500/10 text-red-400 border-red-500/30",
  Medium: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Low: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function exportCsv(contacts: Contact[]) {
  const header = ["Name", "Email", "Phone", "Category", "Location", "CRM status", "Campaign", "Audit"];
  const rows = contacts.map((c) => [
    csvField(c.name),
    csvField(c.email),
    csvField(c.phone ?? ""),
    csvField(c.category ?? ""),
    csvField(c.location ?? ""),
    csvField(c.crm_status),
    csvField(c.campaign_name ?? ""),
    csvField(c.audit_query),
  ]);
  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(email);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded p-1 text-slate-500 hover:text-slate-200"
      title="Copy email"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Row({ c }: { c: Contact }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function setStatus(status: string) {
    setSaving(true);
    await fetch(`/api/businesses/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crm_status: status }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <tr className="border-b border-ink-800">
      <td className="px-4 py-2.5">
        <div className="font-medium text-slate-200">{c.name}</div>
        <div className="text-xs text-slate-500">
          {[c.category, c.location].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1 text-slate-300">
          {c.email}
          <CopyEmailButton email={c.email} />
        </div>
        {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
      </td>
      <td className="px-2 py-2.5 text-slate-400">
        {c.campaign_name ? (
          <div>
            <div className="text-slate-300">{c.campaign_name}</div>
            <div className="text-xs text-slate-500">{c.campaign_stage}</div>
          </div>
        ) : (
          <span className="text-xs text-slate-600">{c.audit_query}</span>
        )}
      </td>
      <td className="px-2 py-2.5">
        {c.priority && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_STYLES[c.priority]}`}
          >
            {c.priority}
          </span>
        )}
      </td>
      <td className="px-2 py-2.5">
        <StatusSelect value={c.crm_status} options={CRM_STATUSES} disabled={saving} onChange={setStatus} />
      </td>
    </tr>
  );
}

export default function ContactsTable({ contacts }: { contacts: Contact[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.email, c.category, c.location, c.campaign_name, c.audit_query]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    );
  }, [contacts, query]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="bg-ink-800 border border-ink-700 rounded-lg text-xs text-slate-200 pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {filtered.length} of {contacts.length}
          </span>
          <button
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>
      <div className="max-h-[36rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-ink-900">
            <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2">Business</th>
              <th className="px-2 py-2">Contact</th>
              <th className="px-2 py-2">Campaign / Audit</th>
              <th className="px-2 py-2">Priority</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <Row key={c.id} c={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
