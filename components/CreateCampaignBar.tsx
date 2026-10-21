"use client";
import { apiFetch } from "@/lib/client-request";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, X } from "lucide-react";
import { Field, FormMessage, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function CreateCampaignBar({
  auditId,
  selectedIds,
  onCreated,
}: {
  auditId: number;
  selectedIds: number[];
  onCreated: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  async function create(e: React.FormEvent) {
    try {
      e.preventDefault();
      setBusy(true);
      setError(null);
      const res = await apiFetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audit_id: auditId,
          name,
          business_ids: selectedIds,
        }),
      });
      setBusy(false);
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to create campaign");
        return;
      }
      const { id } = await res.json();
      onCreated();
      router.push(`/app/campaigns/${id}`);
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
    <>
      <div role="region"
        aria-label="Selection actions"
        className="fixed bottom-4 sm:bottom-6 max-w-[calc(100vw-2rem)] flex-wrap justify-center left-1/2 -translate-x-1/2 z-40 card px-4 py-2.5 flex items-center gap-4 shadow-xl shadow-black/30">
        <span className="text-sm text-slate-200">
          <span className="font-semibold text-indigo-400">
            {selectedIds.length}
          </span>{" "}
          selected
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Rocket /> Create campaign
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setOpen(false)}
        >
          <form
            onSubmit={create}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-campaign-title"
            className="card p-5 space-y-4 w-full max-w-md shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between">
              <h2
                id="new-campaign-title"
                className="text-base font-semibold text-slate-100"
              >
                New campaign
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </div>
            <p className="text-sm text-slate-400">
              {selectedIds.length} businesses selected. The engine will
              automatically generate a homepage redesign mockup and a booking
              link for each.
            </p>
            <Field label="Campaign name">
              <input
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dallas restaurants — round 1"
                className={inputClass}
              />
            </Field>
            {error && <FormMessage>{error}</FormMessage>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create campaign"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
