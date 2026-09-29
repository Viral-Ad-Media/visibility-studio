import Link from "next/link";
import { Check, Clock, ShieldCheck, Wallet } from "lucide-react";
import {
  ACCESS_FEE_USD,
  CREDIT_PACKS,
  TRIAL_DAYS,
  TRIAL_STARTER_CREDIT_USD,
  EST_COST_PER_AUDITED_BUSINESS_USD,
  EST_COST_PER_AUDITED_BUSINESS_LABEL,
  EST_COST_PER_REDESIGN_USD,
  formatUsd,
} from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const EXAMPLE_AUDIT_SIZE = 20;
const est = EST_COST_PER_AUDITED_BUSINESS_USD;

// Rounded down so the estimate never overstates how far a balance goes.
function businessesFor(amountUsd: number) {
  const round = (n: number) => {
    const step = n >= 1000 ? 100 : n >= 50 ? 10 : 1;
    return Math.floor(n / step) * step;
  };
  return `${round(amountUsd / est.high)}–${round(amountUsd / est.low)}`;
}

const STEPS = [
  {
    icon: Clock,
    label: "Start",
    title: `${TRIAL_DAYS}-day free trial`,
    price: "Free",
    badge: "no card required",
    body: `Full access to automated audits and campaigns, plus ${formatUsd(
      TRIAL_STARTER_CREDIT_USD
    )} of starter credit to actually run them. One trial per account.`,
    features: [
      `${formatUsd(TRIAL_STARTER_CREDIT_USD)} starter credit included`,
      "Every feature, nothing held back",
      "No payment details needed to start",
    ],
  },
  {
    icon: ShieldCheck,
    label: "Unlock",
    title: "Lifetime access",
    price: formatUsd(ACCESS_FEE_USD),
    badge: "one-time",
    highlighted: true,
    body: "A single payment for permanent access to the software — no monthly subscription, no per-seat fee.",
    features: [
      "Pay once, keep access",
      "Your credit balance carries over",
      "Invite your team at no extra cost",
      "Every feature, including future ones",
    ],
  },
  {
    icon: Wallet,
    label: "Run",
    title: "Prepaid usage credits",
    price: CREDIT_PACKS.map((p) => p.label).join(" · "),
    priceClass: "text-2xl",
    badge: "top up any time",
    body: "Audits and campaigns draw down your credit balance by what each job actually cost to run. Buy more whenever you need to.",
    features: [
      "Charged per job, at real cost",
      "Credits don't expire",
      "No monthly quota to use or lose",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-100">
          Pay once for access, then pay only for what you run
        </h1>
        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
          Try it free for {TRIAL_DAYS} days. Keep it with a one-time{" "}
          {formatUsd(ACCESS_FEE_USD)} access fee. Audits and campaigns are funded by
          prepaid credits that go down by what each job really cost, with no
          subscription and no monthly quota.
        </p>
      </div>

      <div className="mt-14 grid sm:grid-cols-3 gap-6">
        {STEPS.map((s) => (
          <Card
            key={s.label}
            className={`flex flex-col ${
              s.highlighted ? "border-indigo-500/50 ring-1 ring-indigo-500/30" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center rounded-full border p-1.5">
                  <s.icon className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <CardTitle className="font-mono text-sm text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Badge variant="secondary" className="ml-auto rounded-full">
                  {s.badge}
                </Badge>
              </div>
              <div className="pt-3 font-semibold text-slate-100">{s.title}</div>
              <div className={`tabular font-bold text-slate-100 ${s.priceClass ?? "text-3xl"}`}>
                {s.price}
              </div>
              <CardDescription className="pt-1">{s.body}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2.5">
                {s.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white">
          <Link href="/signup">Start your free trial</Link>
        </Button>
      </div>

      <Card className="mt-16">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-slate-100">What do credits buy?</CardTitle>
            <Badge variant="outline" className="rounded-full text-amber-300 border-amber-500/40">
              rough estimate
            </Badge>
          </div>
          <CardDescription>
            Each job deducts its own real cost: the AI research and the web
            searches it ran. That depends on how much there is to find about
            each business, so there is no fixed price per business. Based on
            the engine&apos;s current limits, expect roughly:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-4">
              <div className="text-xs text-slate-500">Per audited business</div>
              <div className="tabular text-xl font-semibold text-slate-100 mt-1">
                ~{EST_COST_PER_AUDITED_BUSINESS_LABEL}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                A {EXAMPLE_AUDIT_SIZE}-business audit is about{" "}
                {formatUsd(Math.round(EXAMPLE_AUDIT_SIZE * est.low))}–
                {formatUsd(Math.round(EXAMPLE_AUDIT_SIZE * est.high))}
              </div>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-4">
              <div className="text-xs text-slate-500">Per redesign concept</div>
              <div className="tabular text-xl font-semibold text-slate-100 mt-1">
                ~{formatUsd(EST_COST_PER_REDESIGN_USD)}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Booking links are typically free
              </div>
            </div>
            <div className="rounded-lg border border-ink-700 bg-ink-800/50 p-4">
              <div className="text-xs text-slate-500">
                {formatUsd(TRIAL_STARTER_CREDIT_USD)} trial credit
              </div>
              <div className="tabular text-xl font-semibold text-slate-100 mt-1">
                ~{businessesFor(TRIAL_STARTER_CREDIT_USD)} businesses
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Audited, before any top-up
              </div>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-ink-700">
                <th className="py-2 font-medium">Credit pack</th>
                <th className="py-2 font-medium">Roughly this many audited businesses</th>
              </tr>
            </thead>
            <tbody>
              {CREDIT_PACKS.map((p) => (
                <tr key={p.amountUsd} className="border-b border-ink-800 last:border-0">
                  <td className="py-2.5 tabular text-slate-200">{p.label}</td>
                  <td className="py-2.5 tabular text-slate-400">
                    ~{businessesFor(p.amountUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-slate-500 leading-relaxed">
            These are estimates, not quotes or guarantees. Your real per-job
            cost shows in the app next to every audit and campaign, and in your
            account&apos;s audit trail. When your balance reaches $0, new audits
            and campaigns are paused until you top up. Jobs already running
            still finish, so one could take the balance slightly below zero.
          </p>
        </CardFooter>
      </Card>

      <p className="mt-10 text-center text-sm text-slate-500">
        Everyone gets the same accuracy rules: no made-up contact details, and
        every finding comes with its source. Questions?{" "}
        <Link href="/faq" className="text-indigo-400 hover:underline">
          Check the FAQ
        </Link>
        .
      </p>
    </div>
  );
}
