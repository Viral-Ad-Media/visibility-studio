import { cn } from "@/lib/utils";

// One status vocabulary for audits, jobs, and priorities. Each tone pairs its
// colour with a leading dot and a text label, so state never relies on colour
// alone. Pages that are still running already auto-refresh, so the badge stays
// still rather than adding a pulsing dot.
const TONES = {
  amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  red: "bg-red-500/10 text-red-300 border-red-500/30",
  slate: "bg-slate-500/10 text-slate-400 border-slate-500/30",
} as const;

const STATUS_TONE: Record<string, keyof typeof TONES> = {
  queued: "amber",
  pending: "amber",
  running: "cyan",
  ready: "emerald",
  done: "emerald",
  error: "red",
  High: "red",
  Medium: "amber",
  Low: "slate",
};

export default function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Visible text, when it should differ from the raw status value. */
  label?: string;
  className?: string;
}) {
  const tone = STATUS_TONE[status] ?? "slate";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 capitalize whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  );
}
