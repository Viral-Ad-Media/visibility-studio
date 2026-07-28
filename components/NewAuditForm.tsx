"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAuditForm() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [count, setCount] = useState(10);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/audits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, location, target_count: count, notes }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Failed to queue audit");
      setBusy(false);
      return;
    }
    const { id } = await res.json();
    router.push(`/app/audit/${id}`);
  }

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  return (
    <form onSubmit={submit} className="card p-6 space-y-4 animate-fade-in-up">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Niche / category
          </label>
          <input
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="dentists, roofing companies, restaurants…"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Location</label>
          <input
            className={input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Dallas, Lagos, Atlanta…"
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
          Notes for the engine (optional)
        </label>
        <textarea
          className={input + " h-24 resize-none"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. focus on businesses with weak websites, audit these specific sites: …"
        />
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
      >
        {busy ? "Queuing…" : "Queue audit"}
      </button>
      <p className="text-[11px] text-slate-600">
        Audits run automatically — no need to run anything yourself.
      </p>
    </form>
  );
}
