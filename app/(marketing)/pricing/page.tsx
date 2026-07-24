import Link from "next/link";
import { Check } from "lucide-react";

const TIERS = [
  {
    name: "Starter",
    price: "$49",
    period: "/mo",
    tagline: "For solo operators running one niche at a time.",
    cta: "Get started",
    features: [
      "Up to 50 audited businesses / month",
      "1 active campaign",
      "Outreach drafts + scoring",
      "CSV export",
    ],
  },
  {
    name: "Agency",
    price: "$149",
    period: "/mo",
    tagline: "For agencies running multiple niches and campaigns at once.",
    cta: "Get started",
    highlighted: true,
    features: [
      "Up to 300 audited businesses / month",
      "Unlimited campaigns",
      "Redesign concepts + booking links",
      "Google Drive backups",
      "CSV export",
    ],
  },
  {
    name: "Unlimited",
    price: "Custom",
    period: "",
    tagline: "For teams running this at real volume.",
    cta: "Contact us",
    features: [
      "Unlimited audited businesses",
      "Unlimited campaigns",
      "Everything in Agency",
      "Priority support",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-100">Simple, usage-based pricing</h1>
        <p className="mt-4 text-slate-400">
          Priced on how many businesses you actually audit, not per seat.
        </p>
      </div>

      <div className="mt-14 grid sm:grid-cols-3 gap-6">
        {TIERS.map((t) => (
          <div
            key={t.name}
            className={`card p-6 flex flex-col ${
              t.highlighted ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : ""
            }`}
          >
            {t.highlighted && (
              <span className="self-start text-[11px] font-semibold text-indigo-400 uppercase tracking-wide bg-indigo-500/10 border border-indigo-500/30 rounded-full px-2.5 py-1 mb-3">
                Most popular
              </span>
            )}
            <div className="font-semibold text-slate-100">{t.name}</div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="tabular text-3xl font-bold text-slate-100">{t.price}</span>
              <span className="text-sm text-slate-500">{t.period}</span>
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
            <Link
              href={t.cta === "Contact us" ? "/about" : "/app"}
              className={`mt-6 text-center text-sm font-medium px-5 py-2.5 rounded-lg transition-colors ${
                t.highlighted
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                  : "bg-ink-800 hover:bg-ink-700 border border-ink-700 text-slate-200"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-slate-500">
        Every plan includes the same audit accuracy rules — no fabricated
        contact data, every finding sourced. Questions?{" "}
        <Link href="/faq" className="text-indigo-400 hover:underline">
          Check the FAQ
        </Link>
        .
      </p>
    </div>
  );
}
