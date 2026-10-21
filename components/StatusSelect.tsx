"use client";

export default function StatusSelect({
  value,
  label,
  options,
  disabled,
  onChange,
}: {
  value: string;
  /** Accessible name; the visible "Status" text beside it isn't a <label>. */
  label?: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      disabled={disabled}
      aria-label={label ?? "Status"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-ink-800 border border-ink-700 rounded-lg text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/25 disabled:opacity-60"
    >
      {options.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
