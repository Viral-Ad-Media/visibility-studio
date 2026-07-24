"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";

type Props = {
  audit: {
    id: number;
    category: string;
    location: string;
    target_count: number;
    notes: string | null;
    status: string;
  };
};

const btn =
  "flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 " +
  "text-slate-300 px-3 py-1.5 rounded-lg disabled:opacity-50";

export default function AuditActions({ audit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(audit.category);
  const [location, setLocation] = useState(audit.location);
  const [count, setCount] = useState(audit.target_count);
  const [notes, setNotes] = useState(audit.notes ?? "");

  const canEdit = audit.status === "queued" || audit.status === "error";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/audits/${audit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, location, target_count: count, notes }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to save");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 10000);
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/audits/${audit.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to delete");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  return (
    <>
      <div className="flex items-center gap-2">
        {canEdit && (
          <button className={btn} disabled={busy} onClick={() => setEditing(!editing)}>
            {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
        <button
          className={
            confirming
              ? "flex items-center gap-1.5 text-xs bg-red-500/15 border border-red-500/40 text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50"
              : btn + " hover:border-red-500/40 hover:text-red-400"
          }
          disabled={busy}
          onClick={remove}
          title="Delete this audit, its businesses, and any queued jobs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirming ? "Confirm delete?" : "Delete"}
        </button>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24 px-4"
          onClick={() => setEditing(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="card p-5 space-y-4 w-full max-w-xl"
          >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Niche / category
              </label>
              <input
                className={input}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
              <input
                className={input}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Number of businesses
            </label>
            <input
              type="number"
              min={1}
              max={50}
              className={input + " w-32"}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Notes for the engine
            </label>
            <textarea
              className={input + " h-20 resize-none"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
            <button
              disabled={busy}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </div>
      )}
      {error && !editing && <div className="text-sm text-red-400 mt-2">{error}</div>}
    </>
  );
}
