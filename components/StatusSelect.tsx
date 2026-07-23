"use client";

export default function StatusSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-ink-800 border border-ink-700 rounded-lg text-xs text-slate-200 px-2 py-1.5 focus:outline-none focus:border-sky-500"
    >
      {options.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}
