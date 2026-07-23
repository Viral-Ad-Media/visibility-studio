"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteCampaignButton({ campaignId }: { campaignId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 10000);
      return;
    }
    setBusy(true);
    await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
    router.push("/campaigns");
    router.refresh();
  }

  return (
    <button
      disabled={busy}
      onClick={remove}
      title="Delete this campaign and any queued jobs"
      className={
        confirming
          ? "flex items-center gap-1.5 text-xs bg-red-500/15 border border-red-500/40 text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50 shrink-0"
          : "flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-1.5 rounded-lg disabled:opacity-50 shrink-0 hover:border-red-500/40 hover:text-red-400"
      }
    >
      <Trash2 className="w-3.5 h-3.5" />
      {confirming ? "Confirm delete?" : "Delete"}
    </button>
  );
}
