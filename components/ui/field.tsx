import * as React from "react";
import { cn } from "@/lib/utils";

// Shared text-input look for every form in the app (auth, new audit, settings,
// campaign dialogs), so they stop drifting apart one copy-pasted string at a time.
export const inputClass =
  "w-full bg-ink-800 border border-ink-700 rounded-lg px-3 py-2 text-sm text-slate-200 " +
  "placeholder:text-slate-500 transition-colors hover:border-ink-600 " +
  "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25 " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

/**
 * A label that wraps its control, so the label text is programmatically
 * associated with the input (screen readers announce it, clicking it focuses
 * the field) without threading ids through server and client components.
 */
export function Field({
  label,
  hint,
  optional,
  className,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-xs font-medium text-slate-300 mb-1.5">
        {label}
        {optional && <span className="font-normal text-slate-500"> (optional)</span>}
      </span>
      {children}
      {hint && <span className="block mt-1.5 text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/** Inline form feedback, announced to assistive tech when it appears. */
export function FormMessage({
  tone = "error",
  className,
  children,
}: {
  tone?: "error" | "success";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tone === "error"
          ? "bg-red-500/10 text-red-300"
          : "bg-emerald-500/10 text-emerald-300",
        className,
      )}
    >
      {children}
    </p>
  );
}
