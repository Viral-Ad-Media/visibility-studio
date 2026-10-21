import Link from "next/link";
import {
  SearchCheck,
  FileSpreadsheet,
  Wand2,
  CalendarCheck,
  Download,
  KanbanSquare,
} from "lucide-react";
import { ACCESS_FEE_USD, TRIAL_DAYS, TRIAL_STARTER_CREDIT_USD, formatUsd } from "@/lib/pricing";
import { buttonVariants } from "@/components/ui/button";

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
    icon: Download,
    title: "Export everything",
    body: "One-click CSV export for every audit, matching a standard audit-sheet schema so it drops straight into your own workflow.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Queue a niche + location",
    body: "“Roofing companies in Atlanta,” “dentists in Dallas” — whatever you're prospecting this week.",
  },
  {
    n: "2",
    title: "Get a scored, sourced prospect list",
    body: "Each business arrives with an opportunity score, specific visibility issues, and a ready-to-send outreach draft.",
  },
  {
    n: "3",
    title: "Select your campaign",
    body: "Pick the businesses worth pursuing and generate a redesign concept and booking link for each one.",
  },
  {
    n: "4",
    title: "Send it yourself, track the reply",
    body: "Sending stays a manual, human step in your own inbox — the board just tracks where each prospect stands.",
  },
];

export default function MarketingHome() {
  return (
    <div>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20">
        <h1 className="max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-50 leading-[1.05] tracking-[-0.03em]">
          Turn any local-business niche into a scored prospect list with
          ready-to-send outreach
        </h1>
        <p className="mt-6 text-lg text-slate-400 max-w-xl">
          Visibility Studio audits local businesses&apos; web presence, scores the
          opportunity, drafts the outreach, and builds a redesign concept and
          booking link for the ones you decide to pursue.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3">
          <Link href="/app" className={buttonVariants({ size: "lg", className: "h-11" })}>
            Open the app
          </Link>
          <Link
            href="/pricing"
            className={buttonVariants({ variant: "outline", size: "lg", className: "h-11" })}
          >
            See pricing
          </Link>
        </div>
        <p className="mt-5 text-sm text-slate-500">
          {TRIAL_DAYS}-day free trial with {formatUsd(TRIAL_STARTER_CREDIT_USD)} of
          credit · then {formatUsd(ACCESS_FEE_USD)} one-time · pay-as-you-go
          credits, no subscription
        </p>
      </section>

      <section
        aria-labelledby="how-it-works"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-ink-700"
      >
        <h2 id="how-it-works" className="text-2xl sm:text-3xl font-bold text-slate-100">
          How it works
        </h2>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10">
          {STEPS.map((s) => (
            <li key={s.n} className="relative pt-5 border-t-2 border-ink-600">
              <span
                aria-hidden
                className="absolute -top-px left-0 h-0.5 w-10 bg-indigo-400"
              />
              <div className="text-sm font-semibold text-indigo-300 tabular-nums">
                Step {s.n}
              </div>
              <h3 className="font-semibold text-slate-100 mt-1.5">{s.title}</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="what-you-get"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-ink-700"
      >
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-10 lg:gap-16">
          <div>
            <h2 id="what-you-get" className="text-2xl sm:text-3xl font-bold text-slate-100">
              What you get
            </h2>
            <p className="mt-4 text-slate-400 max-w-sm">
              Everything between &ldquo;which businesses?&rdquo; and
              &ldquo;hit send&rdquo;, sourced and ready to act on.
            </p>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-10 gap-y-8">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <dt className="flex items-center gap-2.5 font-semibold text-slate-100">
                  <f.icon aria-hidden className="w-5 h-5 shrink-0 text-indigo-400" />
                  {f.title}
                </dt>
                <dd className="text-sm text-slate-400 mt-2 leading-relaxed">{f.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 border-t border-ink-700">
        <div className="rounded-2xl bg-ink-900 border border-ink-700 px-6 py-10 sm:px-12 sm:py-14 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Never fabricates a fact — every row is sourced
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl">
              Emails, ratings, and findings are only ever recorded when they&apos;re
              publicly verifiable. Anything unverifiable is left blank and noted,
              not guessed — so your outreach never leads with something wrong.
            </p>
          </div>
          <Link
            href="/app"
            className={buttonVariants({ size: "lg", className: "h-11 shrink-0 self-start lg:self-auto" })}
          >
            Open the app
          </Link>
        </div>
      </section>
    </div>
  );
}
