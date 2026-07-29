"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function RequeueButton({ auditId }: { auditId: number }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await fetch(`/api/audits/${auditId}`, { method: "POST" });
            setBusy(false);
            router.refresh();
          }}
          className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Requeue
        </button>
      </TooltipTrigger>
      <TooltipContent>Queue this audit to run again (tops up or refreshes results)</TooltipContent>
    </Tooltip>
  );
}
