"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CREDIT_PACKS } from "@/lib/pricing";

async function startCheckout(body: object) {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

export function BuyAccessButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await startCheckout({ type: "access" });
      }}
    >
      {busy ? "Redirecting…" : "Unlock Visibility Studio — $97 one-time"}
    </button>
  );
}

export function StartTrialButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/billing/start-trial", { method: "POST" });
          setBusy(false);
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setError(body.error ?? "Couldn't start the trial");
            return;
          }
          router.push("/app");
          router.refresh();
        }}
      >
        {busy ? "Starting…" : "Start free 30-day trial"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export function BuyCreditsGrid() {
  const [busy, setBusy] = useState<number | null>(null);
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CREDIT_PACKS.map((pack) => (
        <button
          key={pack.amountUsd}
          disabled={busy !== null}
          onClick={async () => {
            setBusy(pack.amountUsd);
            await startCheckout({ type: "credits", amountUsd: pack.amountUsd });
          }}
          className="card p-4 text-center hover:border-indigo-500 disabled:opacity-50"
        >
          <div className="text-lg font-bold text-slate-100">{pack.label}</div>
          <div className="text-xs text-slate-500">credit</div>
        </button>
      ))}
    </div>
  );
}
