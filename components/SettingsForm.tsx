"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EventType = { uri: string; name: string; duration: number };

export default function SettingsForm({
  initial,
  eventTypes,
  calendlyConnected,
}: {
  initial: Record<string, string>;
  eventTypes: EventType[];
  calendlyConnected: boolean;
}) {
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
    "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 " +
    "focus:ring-2 focus:ring-indigo-500/30";

  return (
    <form onSubmit={save} className="card p-6 space-y-4 animate-fade-in-up">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Calendly event type</label>
        {!calendlyConnected ? (
          <p className="text-sm text-slate-500">Connect Calendly above to pick an event type.</p>
        ) : eventTypes.length === 0 ? (
          <p className="text-sm text-slate-500">
            No active event types found on your connected Calendly account.
          </p>
        ) : (
          <select
            className={input}
            value={calendlyEventTypeUri}
            onChange={(e) => setCalendlyEventTypeUri(e.target.value)}
          >
            <option value="">Auto-pick (engine chooses the best match)</option>
            {eventTypes.map((et) => (
              <option key={et.uri} value={et.uri}>
                {et.name} ({et.duration}min)
              </option>
            ))}
          </select>
        )}
        <p className="text-[11px] text-slate-600 mt-1.5">
          Which Calendly event type booking links should use for campaign outreach. Leave on
          auto-pick and the engine will judge which of your event types fits a cold-outreach
          discovery call — set this if that ever picks the wrong one.
        </p>
      </div>
      <button
        disabled={busy}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
      >
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
