"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-[11px] text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="flex-1 bg-ink-800 border border-ink-700 rounded-lg text-sm text-slate-300 px-3 py-2 focus:outline-none"
        />
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1.5 text-xs bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-300 px-3 py-2 rounded-lg shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function ReferralLinkCard({ link, code }: { link: string; code: string }) {
  return (
    <div className="card p-5 space-y-4">
      <CopyField value={link} label="Your referral link" />
      <CopyField value={code} label="Or share your code" />
    </div>
  );
}
