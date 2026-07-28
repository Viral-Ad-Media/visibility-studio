"use client";

import { useSearchParams } from "next/navigation";

export default function CalendlyConnect({
  connected,
  name,
}: {
  connected: boolean;
  name: string | null;
}) {
  const params = useSearchParams();
  const error = params.get("calendly_error");
  const justConnected = params.get("calendly_connected");

  return (
    <div className="card p-6 space-y-3 animate-fade-in-up">
      <div>
        <h2 className="text-sm font-medium text-slate-200">Calendly</h2>
        <p className="text-[11px] text-slate-600 mt-1">
          Booking links for campaign outreach are created on your connected Calendly account.
        </p>
      </div>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          Couldn&apos;t connect Calendly: {error}
        </p>
      )}
      {justConnected && !error && (
        <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          Calendly connected.
        </p>
      )}
      {connected ? (
        <p className="text-sm text-slate-300">
          Connected as <span className="font-medium text-slate-100">{name}</span>.
        </p>
      ) : (
        <p className="text-sm text-slate-400">Not connected yet.</p>
      )}
      <a
        href="/api/calendly/authorize"
        className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg"
      >
        {connected ? "Reconnect Calendly" : "Connect Calendly"}
      </a>
    </div>
  );
}
