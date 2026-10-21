"use client";
import { apiFetch } from "@/lib/client-request";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { Field, FormMessage, inputClass as input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Props = {
  audit: {
    id: number;
    category: string;
    location: string;
    target_count: number;
    notes: string | null;
    status: string;
  };
};

const btn =
  "flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 " +
  "text-slate-300 px-3 py-1.5 rounded-lg disabled:opacity-50";

export default function AuditActions({ audit }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(audit.category);
  const [location, setLocation] = useState(audit.location);
  const [count, setCount] = useState(audit.target_count);
  const [notes, setNotes] = useState(audit.notes ?? "");

  const canEdit = audit.status === "ready" || audit.status === "error";

  // Escape closes the edit dialog, like every other dialog the user knows.
  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  async function save(e: React.FormEvent) {
    try {
      e.preventDefault();
      setBusy(true);
      setError(null);
      const res = await apiFetch(`/api/audits/${audit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          location,
          target_count: count,
          notes,
        }),
      });
      setBusy(false);
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to save");
        return;
      }
      setEditing(false);
      router.refresh();
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

  async function remove() {
    try {
      if (!confirming) {
        setConfirming(true);
        setTimeout(() => setConfirming(false), 10000);
        return;
      }
      setBusy(true);
      const res = await apiFetch(`/api/audits/${audit.id}`, {
        method: "DELETE",
      });
      setBusy(false);
      if (!res.ok) {
        setError((await res.json()).error ?? "Failed to delete");
        return;
      }
      router.push("/app");
      router.refresh();
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
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <button
            className={btn}
            disabled={busy}
            onClick={() => setEditing(!editing)}
          >
            {editing ? (
              <X className="w-3.5 h-3.5" />
            ) : (
              <Pencil className="w-3.5 h-3.5" />
            )}
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
        <button
          className={
            confirming
              ? "flex items-center gap-1.5 text-xs bg-red-500/15 border border-red-500/40 text-red-400 px-3 py-1.5 rounded-lg disabled:opacity-50"
              : btn + " hover:border-red-500/40 hover:text-red-400"
          }
          disabled={busy}
          onClick={remove}
          title="Delete this audit, its businesses, and any queued jobs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {confirming ? "Confirm delete?" : "Delete"}
        </button>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-16 sm:pt-24 px-4"
          onClick={() => setEditing(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-audit-title"
            className="card p-5 space-y-4 w-full max-w-xl shadow-2xl shadow-black/40"
          >
            <div className="flex items-center justify-between gap-4">
              <h2
                id="edit-audit-title"
                className="text-base font-semibold text-slate-100"
              >
                Edit audit
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400"
                onClick={() => setEditing(false)}
                aria-label="Close"
              >
                <X />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Niche / category">
                <input
                  className={input}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  autoFocus
                />
              </Field>
              <Field label="Location">
                <input
                  className={input}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
              </Field>
            </div>
            <Field label="Number of businesses" hint="Between 1 and 50.">
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
                className={input + " h-20 resize-y"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            {error && <FormMessage>{error}</FormMessage>}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      )}
      {error && !editing && (
        <FormMessage className="mt-2">{error}</FormMessage>
      )}
    </>
  );
}
