"use client";
import { apiFetch } from "@/lib/client-request";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function NewAuditForm() {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [count, setCount] = useState(10);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    try {
      e.preventDefault();
      setBusy(true);
      setError(null);
      const res = await apiFetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          location,
          target_count: count,
          notes,
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to queue audit");
        setBusy(false);
        return;
      }
      const { id } = await res.json();
      router.push(`/app/audit/${id}`);
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
    <form onSubmit={submit} className="card p-5 sm:p-6 space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Niche / category">
          <input
            className={input}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="dentists, roofing companies, restaurants…"
            required
            autoFocus
          />
        </Field>
        <Field label="Location">
          <input
            className={input}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Dallas, Lagos, Atlanta…"
            required
          />
        </Field>
      </div>
      <Field
        label="Number of businesses"
        hint="Between 1 and 50. Each audited business draws down your credit balance."
      >
        <input
          type="number"
          min={1}
          max={50}
          className={input + " w-32 tabular-nums"}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
        />
      </Field>
      <Field label="Notes for the engine" optional>
        <textarea
          className={input + " h-24 resize-y"}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. focus on businesses with weak websites, audit these specific sites: …"
        />
      </Field>
      {error && <FormMessage>{error}</FormMessage>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
        <p className="text-xs text-slate-500">
          Runs automatically once queued. Results appear as each business is
          audited.
        </p>
        <Button type="submit" disabled={busy} className="shrink-0">
          {busy ? "Queuing…" : "Queue audit"}
        </Button>
      </div>
    </form>
  );
}
