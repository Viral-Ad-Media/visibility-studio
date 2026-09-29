// Pricing constants — safe to import from client components (no server-only deps).
// Checkout Sessions are created with ad-hoc price_data, so no pre-created Stripe
// Products/Prices are required. Adjust freely.
//
// The marketing site (/pricing, /faq, home) and /billing all render from these,
// so there is exactly one place to change a price.

export const ACCESS_FEE_CENTS = 9700; // one-time software access fee: $97
export const ACCESS_FEE_USD = ACCESS_FEE_CENTS / 100;
export const CREDIT_PACKS = [
  { amountUsd: 50, cents: 5000, label: "$50" },
  { amountUsd: 100, cents: 10000, label: "$100" },
  { amountUsd: 250, cents: 25000, label: "$250" },
] as const;

// Mirrors the vis_start_trial() Postgres RPC (interval '30 days', a $20
// 'trial_starter_credit' ledger row). The RPC is the source of truth for what
// actually gets granted — change both together.
export const TRIAL_DAYS = 30;
export const TRIAL_STARTER_CREDIT_USD = 20;

// Rough, marketing-only estimates of what a job deducts from credits. Real
// deductions are each job's own measured estimated_cost_usd (lib/engine/worker.ts),
// so these are never used for billing. Basis: an audit_business job is capped at
// 8 web_search calls ($0.01 each) plus up to 8 web_fetch page loads fed back as
// input tokens (lib/engine/anthropic.ts); build_redesign measured ~$0.07–0.08 in
// production; create_booking_link is $0 unless it needs a Claude pick among
// several Calendly event types.
export const EST_COST_PER_AUDITED_BUSINESS_USD = { low: 0.15, high: 0.5 } as const;
export const EST_COST_PER_REDESIGN_USD = 0.1;

export function formatUsd(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

// e.g. "$0.15–$0.50"
export const EST_COST_PER_AUDITED_BUSINESS_LABEL = `${formatUsd(
  EST_COST_PER_AUDITED_BUSINESS_USD.low
)}–${formatUsd(EST_COST_PER_AUDITED_BUSINESS_USD.high)}`;
