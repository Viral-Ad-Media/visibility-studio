// Pricing constants — safe to import from client components (no server-only deps).
// Checkout Sessions are created with ad-hoc price_data, so no pre-created Stripe
// Products/Prices are required. Adjust freely.

export const ACCESS_FEE_CENTS = 9700; // one-time software access fee: $97
export const CREDIT_PACKS = [
  { amountUsd: 50, cents: 5000, label: "$50" },
  { amountUsd: 100, cents: 10000, label: "$100" },
  { amountUsd: 250, cents: 25000, label: "$250" },
] as const;

// Display-only mirrors of values that live in the vis_start_trial() Postgres
// function (it's what actually grants them) — change both together.
export const TRIAL_DAYS = 30;
export const TRIAL_STARTER_CREDIT_USD = 20;
