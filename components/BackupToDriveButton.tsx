"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HardDriveUpload, ExternalLink } from "lucide-react";

export default function BackupToDriveButton({
  auditId,
  driveUrl,
  backedUpAt,
}: {
  auditId: number;
  driveUrl: string | null;
  backedUpAt: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      {driveUrl && (
        <a
          href={driveUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-1.5 rounded-lg"
          title={backedUpAt ? `Backed up ${backedUpAt.slice(0, 10)}` : undefined}
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Drive backup{backedUpAt ? ` (${backedUpAt.slice(0, 10)})` : ""}
        </a>
      )}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/audits/${auditId}/backup`, { method: "POST" });
          setBusy(false);
          router.refresh();
        }}
        className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
        title="Queue a Drive backup of this audit's CSV — a Google Sheet copy, separate from the local database"
      >
        <HardDriveUpload className="w-3.5 h-3.5" />
        {driveUrl ? "Back up again" : "Back up to Drive"}
      </button>
    </div>
  );
}
