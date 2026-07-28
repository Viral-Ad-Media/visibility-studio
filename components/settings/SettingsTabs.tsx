"use client";

import { useState, type ReactNode } from "react";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "team", label: "Team" },
  { key: "integrations", label: "Integrations" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsTabs({
  profile,
  team,
  integrations,
}: {
  profile: ReactNode;
  team: ReactNode;
  integrations: ReactNode;
}) {
  const [active, setActive] = useState<TabKey>("profile");
  const panels: Record<TabKey, ReactNode> = { profile, team, integrations };

  return (
    <div>
      <div className="flex gap-1 border-b border-ink-700 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`text-sm px-4 py-2 border-b-2 -mb-px transition-colors ${
              active === t.key
                ? "border-indigo-500 text-slate-100"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {panels[active]}
    </div>
  );
}
