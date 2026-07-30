"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, X } from "lucide-react";

export default function CreateCampaignBar({
  auditId,
  selectedIds,
  onCreated,
}: {
  auditId: number;
  selectedIds: number[];
  onCreated: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audit_id: auditId, name, business_ids: selectedIds }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to create campaign");
      return;
    }
    const { id } = await res.json();
    onCreated();
    router.push(`/app/campaigns/${id}`);
  }

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 card px-5 py-3 flex items-center gap-4 shadow-xl border-indigo-600/40">
        <span className="text-sm text-slate-200">
          <span className="font-semibold text-indigo-400">{selectedIds.length}</span> selected
        </span>
        <button
          onClick={() => setOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg flex items-center gap-1.5"
        >
          <Rocket className="w-3.5 h-3.5" /> Create campaign
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            className="card p-5 space-y-4 w-full max-w-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-100">New campaign</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {selectedIds.length} businesses selected. The engine will automatically generate a
              homepage redesign mockup and a booking link for each.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Campaign name
              </label>
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dallas restaurants — round 1"
                className="w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            {error && <div className="text-sm text-red-400">{error}</div>}
            <button
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
            >
              {busy ? "Creating…" : "Create campaign"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
