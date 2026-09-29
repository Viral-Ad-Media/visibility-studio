"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the switch still applies for this page view.
  }
}

// variant "icon": compact square button (marketing header).
// variant "row": full-width labelled row matching the cockpit sidebar's links.
export default function ThemeToggle({
  variant = "icon",
  className = "",
}: {
  variant?: "icon" | "row";
  className?: string;
}) {
  // null until mounted: the server can't know the stored theme, so render a
  // neutral placeholder first rather than an icon that might be wrong.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  const next: Theme = theme === "light" ? "dark" : "light";
  const label = `Switch to ${next} mode`;

  const icon =
    theme === null ? (
      <span className="w-4 h-4 shrink-0" />
    ) : theme === "light" ? (
      <Moon className="w-4 h-4 shrink-0" />
    ) : (
      <Sun className="w-4 h-4 shrink-0" />
    );

  return (
    <button
      type="button"
      onClick={() => {
        // Read the live class, not `theme` state, so rapid clicks can't act on a stale value.
        const target: Theme = document.documentElement.classList.contains("light") ? "dark" : "light";
        applyTheme(target);
        setTheme(target);
      }}
      aria-label={label}
      title={label}
      className={
        variant === "row"
          ? `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-ink-800 hover:text-slate-200 ${className}`
          : `inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-ink-800 transition-colors ${className}`
      }
    >
      {icon}
      {variant === "row" && (theme === null ? "Theme" : theme === "light" ? "Dark mode" : "Light mode")}
    </button>
  );
}
