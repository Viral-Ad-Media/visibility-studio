"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsForm({ initial }: { initial: Record<string, string> }) {
  const router = useRouter();
  const [calendlyEventTypeUri, setCalendlyEventTypeUri] = useState(
    initial.calendly_event_type_uri ?? ""
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendly_event_type_uri: calendlyEventTypeUri }),
    });
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  const input =
    "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
    "placeholder:text-slate-600 focus:outline-none focus:border-sky-500";

  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">
          Calendly event type URI
        </label>
        <input
          className={input}
          value={calendlyEventTypeUri}
          onChange={(e) => setCalendlyEventTypeUri(e.target.value)}
          placeholder="https://api.calendly.com/event_types/…"
        />
        <p className="text-[11px] text-slate-600 mt-1.5">
          Which Calendly event type booking links should use for campaign outreach. Leave blank
          and the engine will use your first active event type automatically — set this if that
          picks the wrong one. Find the URI via the connected Calendly account&apos;s
          event-types list.
        </p>
      </div>
      <button
        disabled={busy}
        className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
