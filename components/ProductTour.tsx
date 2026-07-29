"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "vis_product_tour_dismissed";

const STEPS = [
  {
    id: "tour-nav-audits",
    title: "Audits",
    body: "Every audit you queue shows up here once it's ready — businesses found, scored, and ready to review.",
  },
  {
    id: "tour-nav-new-audit",
    title: "New audit",
    body: "Give it a niche and a location. It finds real local businesses and audits each one automatically — nothing to run yourself.",
  },
  {
    id: "tour-nav-campaigns",
    title: "Campaigns",
    body: "Select businesses from an audit and turn them into a campaign — a homepage redesign mockup plus a real booking link, generated per business.",
  },
  {
    id: "tour-nav-audit-trail",
    title: "Audit trail",
    body: "A running log of account activity — team changes, integrations, and what each audit/campaign job actually cost.",
  },
  {
    id: "tour-nav-settings",
    title: "Settings",
    body: "Your profile, team members, and integrations (like connecting Calendly for real booking links) all live here.",
  },
  {
    id: "tour-nav-billing",
    title: "Credit balance",
    body: "Credits fund the real cost of running audits and campaigns. Click here any time to check your balance or top up.",
  },
] as const;

// A lightweight, hand-rolled step tour — highlights an existing sidebar
// element by id (set in components/Nav.tsx) rather than pulling in a full
// tour library, since every anchor is a fixed, always-present nav item (no
// need to handle page-specific/scroll-dependent targets). Dismissal is
// per-browser (localStorage), not account-level: a product tour orients a
// *person*, not the account, so a new teammate on a fresh browser should
// still see it once.
export default function ProductTour() {
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setStepIndex(0);
  }, []);

  useEffect(() => {
    if (stepIndex === null) return;
    const step = STEPS[stepIndex];

    function measure() {
      const el = document.getElementById(step.id);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [stepIndex]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setStepIndex(null);
  }

  if (stepIndex === null || !rect) return null;
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // Anchors are all in the sidebar — position the card just to the right
  // of the highlighted item, vertically centered on it, clamped so it
  // never runs off the bottom of the viewport.
  const top = Math.min(Math.max(rect.top - 8, 8), window.innerHeight - 200);
  const left = rect.right + 12;

  return (
    <>
      <div
        className="fixed z-40 rounded-lg ring-2 ring-indigo-500 ring-offset-2 ring-offset-ink-950 pointer-events-none transition-all duration-200"
        style={{ top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 }}
      />
      <div
        className="fixed z-40 w-72 card p-4 shadow-xl border-indigo-600/40 transition-all duration-200"
        style={{ top, left }}
      >
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-slate-100">{step.title}</h3>
          <button
            onClick={dismiss}
            className="text-slate-500 hover:text-slate-300 shrink-0"
            aria-label="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mb-3">{step.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-600 tabular">
            {stepIndex + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => (i ?? 1) - 1)}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1"
              >
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? dismiss() : setStepIndex((i) => (i ?? 0) + 1))}
              className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1.5 rounded-lg"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
