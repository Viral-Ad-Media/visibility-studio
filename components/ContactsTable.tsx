"use client";
import { apiFetch } from "@/lib/client-request";
import { csvCell as csvField } from "@/lib/csv-cell";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Download, Search } from "lucide-react";
import type { Contact } from "@/lib/shared";
import { CRM_STATUSES } from "@/lib/shared";
import StatusSelect from "@/components/StatusSelect";
import StatusBadge from "@/components/StatusBadge";


function exportCsv(contacts: Contact[]) {
  const header = [
    "Name",
    "Email",
    "Phone",
    "Category",
    "Location",
    "CRM status",
    "Campaign",
    "Audit",
  ];
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
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch (error) {
          window.alert(
            error instanceof Error
              ? error.message
              : "Operation failed. Please try again.",
          );
        }
      }}
      type="button"
      className="rounded p-1 text-slate-500 hover:text-slate-200"
      title="Copy email"
      aria-label={copied ? "Copied" : `Copy ${email}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function Row({ c }: { c: Contact }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function setStatus(status: string) {
    try {
      setSaving(true);
      await apiFetch(`/api/businesses/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crm_status: status }),
      });
      setSaving(false);
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Operation failed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b border-ink-800 hover:bg-ink-800/40">
      <td className="px-4 py-2.5">
        <div className="font-medium text-slate-200">{c.name}</div>
        <div className="text-xs text-slate-500">
          {[c.category, c.location].filter(Boolean).join(" · ")}
        </div>
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-1 text-slate-300 whitespace-nowrap">
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
          <StatusBadge status={c.priority} />
        )}
      </td>
      <td className="px-2 py-2.5">
        <StatusSelect
          label={`CRM status for ${c.name}`}
          value={c.crm_status}
          options={CRM_STATUSES}
          disabled={saving}
          onChange={setStatus}
        />
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
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-700 px-4 py-3">
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"
          />
          <input
            type="search"
            aria-label="Search contacts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="bg-ink-800 border border-ink-700 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 pl-8 pr-3 py-1.5 w-full focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 tabular-nums" aria-live="polite">
            {filtered.length} of {contacts.length}
          </span>
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 bg-ink-800 px-2.5 py-1.5 text-xs text-slate-300 hover:border-indigo-500 hover:text-indigo-300"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>
      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="sticky top-0 bg-ink-900">
            <tr className="border-b border-ink-700 text-left text-xs font-medium text-slate-400">
              <th scope="col" className="px-4 py-2 font-medium">Business</th>
              <th scope="col" className="px-2 py-2 font-medium">Contact</th>
              <th scope="col" className="px-2 py-2 font-medium">Campaign / Audit</th>
              <th scope="col" className="px-2 py-2 font-medium">Priority</th>
              <th scope="col" className="px-2 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <Row key={c.id} c={c} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  No contacts match &ldquo;{query.trim()}&rdquo;.{" "}
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="text-indigo-400 hover:underline"
                  >
                    Clear search
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
