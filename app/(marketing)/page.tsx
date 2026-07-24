import Link from "next/link";
import {
  SearchCheck,
  FileSpreadsheet,
  Wand2,
  CalendarCheck,
  HardDriveUpload,
  KanbanSquare,
} from "lucide-react";

const FEATURES = [
  {
    icon: SearchCheck,
    title: "Automated visibility audits",
    body: "Give it a niche and a location. It finds the businesses, audits each website's SEO, conversion, and trust signals, and scores every prospect 1–5 on opportunity.",
  },
  {
    icon: FileSpreadsheet,
    title: "Public contact discovery",
    body: "Scrapes publicly visible emails from contact pages, footers, and directories — never guesses or invents an address, and always cites its sources.",
  },
  {
    icon: Wand2,
    title: "Personalized outreach drafts",
    body: "Every high- and medium-priority prospect gets a subject line and email grounded in a real, specific finding from its own audit — not a generic template.",
  },
  {
    icon: KanbanSquare,
    title: "Campaigns with a real pipeline",
    body: "Select the businesses worth pursuing and track them through Selected → Sent → Replied → Booked → Won, one board per campaign.",
  },
  {
    icon: CalendarCheck,
    title: "Redesign concepts + booking links",
    body: "Each campaign business gets a coded homepage redesign concept addressing its own audit findings, plus a real, single-use booking link — ready to attach to your outreach.",
  },
  {
    icon: HardDriveUpload,
    title: "Export everything",
    body: "One-click CSV export matching a standard audit-sheet schema, plus automatic Google Drive backups of every mockup and audit.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Queue a niche + location",
    body: "“Roofing companies in Atlanta,” “dentists in Dallas” — whatever you're prospecting this week.",
  },
  {
    n: "02",
    title: "Get a scored, sourced prospect list",
    body: "Each business arrives with an opportunity score, specific visibility issues, and a ready-to-send outreach draft.",
  },
  {
    n: "03",
    title: "Select your campaign",
    body: "Pick the businesses worth pursuing and generate a redesign concept and booking link for each one.",
  },
  {
    n: "04",
    title: "Send it yourself, track the reply",
    body: "Sending stays a manual, human step in your own inbox — the board just tracks where each prospect stands.",
  },
];

export default function MarketingHome() {
  return (
    <div>
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 leading-tight">
          Turn any local-business niche into a{" "}
          <span className="text-indigo-400">scored prospect list</span> with
          ready-to-send outreach
        </h1>
        <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
          Visibility Studio audits local businesses&apos; web presence, scores the
          opportunity, drafts the outreach, and builds a redesign concept and
          booking link for the ones you decide to pursue.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/app"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-6 py-3 rounded-lg transition-colors"
          >
            Open the app
          </Link>
          <Link
            href="/pricing"
            className="bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-200 text-sm font-medium px-6 py-3 rounded-lg transition-colors"
          >
            See pricing
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-ink-700">
        <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-wide text-center">
          How it works
        </h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5">
              <div className="tabular text-2xl font-bold text-indigo-500/60">{s.n}</div>
              <div className="font-semibold text-slate-100 mt-2">{s.title}</div>
              <div className="text-sm text-slate-400 mt-1.5">{s.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16 border-t border-ink-700">
        <h2 className="text-sm font-semibold text-indigo-400 uppercase tracking-wide text-center">
          What you get
        </h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-6">
              <f.icon className="w-6 h-6 text-indigo-400" />
              <div className="font-semibold text-slate-100 mt-3">{f.title}</div>
              <div className="text-sm text-slate-400 mt-1.5 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-20 text-center border-t border-ink-700">
        <h2 className="text-2xl font-bold text-slate-100">
          Never fabricates a fact — every row is sourced
        </h2>
        <p className="mt-4 text-slate-400">
          Emails, ratings, and findings are only ever recorded when they&apos;re
          publicly verifiable. Anything unverifiable is left blank and noted,
          not guessed — so your outreach never leads with something wrong.
        </p>
        <Link
          href="/app"
          className="inline-block mt-8 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-6 py-3 rounded-lg transition-colors"
        >
          Open the app
        </Link>
      </section>
    </div>
  );
}
