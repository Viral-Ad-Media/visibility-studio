"use client";
import { apiFetch } from "@/lib/client-request";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormMessage, inputClass as input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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
    initial.calendly_event_type_uri ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    try {
      e.preventDefault();
      setBusy(true);
      setSaved(false);
      setError(null);
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendly_event_type_uri: calendlyEventTypeUri }),
      });
      setBusy(false);
      if (!res.ok) {
        setError("Couldn't save — try again");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Operation failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }


  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <label className="block">
        <span className="block text-xs font-medium text-slate-300 mb-1.5">
          Calendly event type
        </span>
        {!calendlyConnected ? (
          <p className="text-sm text-slate-500">
            Connect Calendly above to pick an event type.
          </p>
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
        <span className="block text-xs text-slate-500 mt-1.5 max-w-prose">
          Which Calendly event type booking links should use for campaign
          outreach. Leave on auto-pick and the engine will judge which of your
          event types fits a cold-outreach discovery call — set this if that
          ever picks the wrong one.
        </span>
      </label>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : saved ? "Saved" : "Save"}
      </Button>
      {error && <FormMessage>{error}</FormMessage>}
    </form>
  );
}
