import Link from "next/link";
import { Check } from "lucide-react";
import {
  ACCESS_FEE_CENTS,
  CREDIT_PACKS,
  TRIAL_DAYS,
  TRIAL_STARTER_CREDIT_USD,
} from "@/lib/pricing";

// Every number on this page comes from lib/pricing.ts — the same constants
// app/api/billing/checkout uses to create the Stripe Checkout Session — so
// the public page can't drift from what customers are actually charged.
const accessFeeUsd = ACCESS_FEE_CENTS / 100;

const STEPS = [
  {
    step: "1",
    name: "Free trial",
    price: "$0",
    period: `for ${TRIAL_DAYS} days`,
    tagline: "Try the whole product on real niches before paying anything.",
    features: [
      `$${TRIAL_STARTER_CREDIT_USD} of starter credit included`,
      "Every feature — audits, campaigns, redesign concepts, booking links",
      "No card required to start",
    ],
  },
  {
    step: "2",
    name: "Access",
    price: `$${accessFeeUsd}`,
    period: "one-time",
    tagline: "Unlock the software for good. No subscription, no per-seat fee.",
    highlighted: true,
    features: [
      "Keep access after your trial ends",
      "Invite your team at no extra cost",
      "CSV export of every audit",
    ],
  },
  {
    step: "3",
    name: "Credits",
    price: CREDIT_PACKS[0].label,
    period: "and up, prepaid",
    tagline: "Prepaid usage. Top up only when you need more.",
    features: [
      `Packs of ${CREDIT_PACKS.map((p) => p.label).join(", ")}`,
      "Each audit and campaign job draws down its actual cost",
      "Every job's cost shown in the app and your audit trail",
      "New work pauses at $0 — never an unexpected bill",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-100">Simple, pay-for-what-you-run pricing</h1>
        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
          Start free for {TRIAL_DAYS} days. Keep it with a one-time ${accessFeeUsd} access fee, then
          add prepaid credits as you run audits and campaigns. No monthly subscription.
        </p>
      </div>

      <div className="mt-14 grid sm:grid-cols-3 gap-6">
        {STEPS.map((t) => (
          <div
            key={t.name}
            className={`card p-6 flex flex-col ${
              t.highlighted ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : ""
            }`}
          >
            <span className="self-start text-[11px] font-semibold text-indigo-400 uppercase tracking-wide bg-indigo-500/10 border border-indigo-500/30 rounded-full px-2.5 py-1 mb-3">
              Step {t.step}
            </span>
            <div className="font-semibold text-slate-100">{t.name}</div>
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              <span className="tabular text-3xl font-bold text-slate-100">{t.price}</span>
              {t.period && <span className="text-sm text-slate-400">{t.period}</span>}
            </div>
            <p className="text-sm text-slate-400 mt-2">{t.tagline}</p>
            <ul className="mt-6 space-y-2.5 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/signup"
          className="inline-block text-sm font-medium px-6 py-3 rounded-lg transition-colors bg-indigo-600 hover:bg-indigo-500 text-white"
        >
          Start your free trial
        </Link>
      </div>

      <div className="mt-16 card p-6 max-w-3xl mx-auto">
        <h2 className="font-semibold text-slate-100">How credits work</h2>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          Audits and campaigns run on live AI research: web searches, site fetches, and a model call
          per business. Each job draws its own real cost from your credit balance when it finishes,
          so a bigger audit costs more and a small one costs less. You can see the exact cost of
          every audit, redesign concept, and booking link in the app. If your balance reaches $0,
          work already running finishes and new work waits until you top up. Nothing is charged to
          your card automatically.
        </p>
      </div>

      <p className="mt-10 text-center text-sm text-slate-400">
        Every account gets the same audit accuracy rules: no fabricated contact data, and every
        finding is sourced. Questions?{" "}
        <Link href="/faq" className="text-indigo-400 hover:underline">
          Check the FAQ
        </Link>
        .
      </p>
    </div>
  );
}
