# Visibility Studio

Multi-tenant business-visibility audit SaaS. The Next.js app (deployed on Vercel) is the visual
cockpit; **Supabase (Postgres + Auth) is the database**, with every tenant-owned table scoped by
Row Level Security via `account_id`. Both audits (`run_audit`/`audit_business` jobs) and campaigns
(`build_redesign`/`create_booking_link` jobs — turning a selection of audited businesses into a
coded homepage redesign mockup + a real Calendly booking link per business) are handled by **an
automated Anthropic-API-based worker** (`lib/engine/*`) that drains `vis_jobs` the instant a row is
inserted — no human runs anything (Phase C, verified live in production). There is no Google Drive
integration — as a SaaS product, audit CSVs export directly from the app (`/api/audits/{id}/csv`)
rather than backing up to anyone's personal Drive. Sending outreach stays a human action, outside
this app.

## The automated engine

`run_audit`/`audit_business`/`build_redesign`/`create_booking_link` jobs all process
automatically, near-instantly, with no human trigger:

- **Trigger**: a Postgres trigger on `vis_jobs` (`on_vis_job_inserted`, via the `pg_net` extension)
  POSTs to `app/api/engine/run` the instant a row is inserted. A `pg_cron` job
  (`vis-engine-drain-backstop`, every minute, Postgres-side — not gated by any Vercel plan's
  cron-frequency limit) calls the same endpoint as a backstop, driving forward audits and
  reclaiming anything that died mid-run. Both configured via the Supabase MCP's `apply_migration`
  (migration `vis_engine_automation`).
- **Auth**: the route checks an `x-engine-secret` header against `ENGINE_WEBHOOK_SECRET` — the
  matching value lives in Supabase Vault (`vis_engine_webhook_url`/`vis_engine_webhook_secret`,
  set via `execute_sql`, never committed to git).
- **Processing**: `lib/engine/worker.ts` claims one job via the `vis_claim_job()` RPC (`SECURITY
  DEFINER`, `FOR UPDATE SKIP LOCKED`), bounded to ~50s per invocation (`maxDuration = 60` on the
  route). A `run_audit` job (`lib/engine/discover.ts`) discovers up to `target_count` candidate
  businesses via the Claude API + `web_search`, then fans out one `audit_business` job row per
  candidate — those get drained independently (and concurrently, across separate invocations) by
  the same worker. Each `audit_business` job (`lib/engine/auditBusiness.ts`) researches one
  business via `web_search`/`web_fetch`, then submits findings via a forced tool call
  (`submit_business`, validated with `zod`) and upserts through the shared
  `lib/business-upsert.ts` (also used by `scripts/engine.ts`, so the two paths can never diverge).
  A job that fails is retried (via `vis_claim_job`'s staleness reclaim) up to 5 attempts
  (`vis_jobs.attempts`) before being marked terminally `error`; a single business permanently
  failing doesn't fail the whole audit. The last `audit_business` job for an audit to finish
  triggers a **deterministic templated** `summary_md` (top opportunities, counts) — not another
  Claude call — and marks the audit `ready`. `build_redesign`/`create_booking_link` jobs work the
  same way through the same worker/claim/retry mechanics — `lib/engine/redesign.ts` generates the
  mockup via a plain-text Claude call, `lib/engine/booking.ts` creates a real Calendly booking
  link (per-tenant OAuth token, see "Calendly OAuth" below) — the only difference is which stage
  function `lib/engine/worker.ts` dispatches to based on `job.type`.
- `scripts/engine.ts` (the old `/run-audits`/`/run-campaigns` CLI) still exists as a **manual/debug
  fallback** for all four job types — useful for inspecting a job's context or manually
  driving/failing something stuck — but it is no longer the primary path for any of them.

**Vercel hosts the cockpit and the entire automated engine** — audits and campaigns alike drain
with no human involvement.

## Routes

The app root is a **public marketing site** (`app/(marketing)/` route group — `/`, `/about`,
`/pricing`, `/faq`, `/terms`), pitching Visibility Studio as a product. It has its own layout
(`MarketingNav` + `MarketingFooter`, no sidebar) and is fully static — none of it touches the
database. The actual cockpit (audits, campaigns, settings — everything that used to live at `/`)
now lives under **`/app/*`** (`app/app/`), with its own layout carrying the sidebar `Nav`. Don't
add cockpit pages back at the root, and don't add marketing pages under `/app`.

## Contacts and Emails

Two read/write UI surfaces over data the engine already produces — no new tables, no new job
types. Deliberately **not** a port of what a sibling project (clickbank-studio) calls "Contacts"/
"Broadcast" there: that app captures third-party leads via a public opt-in form and sends real
automated email through a connected mail provider, neither of which exists (or is wanted) here —
scope was explicitly confirmed with the user before building rather than assumed from the name.

- **Contacts** (`app/app/contacts/page.tsx` + `components/ContactsTable.tsx`) is a unified CRM
  view over `vis_businesses`: every business, across every audit, that has a found email —
  `DISTINCT ON (b.id)` joined to its audit and (if any) its latest `vis_campaign_businesses`
  membership, so a business shows its campaign context if it has one. Search, per-row CRM status
  change (reuses the existing `PATCH /api/businesses/[id]`), and a client-side CSV export — same
  shape as every other CSV export in this app.
- **Emails** (`app/app/emails/page.tsx` + `components/EmailQueue.tsx`, originally named
  "Broadcast" — renamed for clarity, no behavior change) is a bulk outreach queue, narrowed to
  businesses that also have a drafted `outreach_email`. Multi-select + a sticky bottom action bar
  (same fixed-bottom-bar pattern as `CreateCampaignBar.tsx`) to copy every selected draft at once
  or bulk-mark them `Contacted`. Per-row actions are a `mailto:` link (opens the user's own mail
  client, prefilled) and a single-draft copy button. **There is no send button and no mail
  provider integration** — this stays consistent with content rule 8 below (outreach delivery is
  always a manual, human step); it only makes queuing/copying/tracking that manual step across
  many contacts faster.
- **`PATCH /api/businesses/bulk-status`** (new) is the only new route — updates `crm_status` for
  an array of business ids in one call (`WHERE id = ANY(?)`), used by Emails' bulk
  "Mark as Contacted". Scoped by the same impersonated `db` connection (real RLS) as every other
  business write in this app; no service-role bypass.

## The skills

| Skill | Trigger | What it does |
|---|---|---|
| `/run-audits` | manual/debug fallback only — audits now drain automatically, see "The automated engine" | drains pending `run_audit` / `audit_business` jobs by hand — finds businesses in the niche + location, audits each website, scrapes public contact emails, scores 1–5, drafts personalized outreach, and writes each business row back into the DB as it finishes |
| `/run-campaigns` | manual/debug fallback only — campaigns now drain automatically, see "The automated engine" | drains pending `build_redesign` / `create_booking_link` jobs by hand — builds a self-contained HTML redesign mockup addressing that business's own findings and creates a real single-use Calendly booking link |

## Database

Postgres on Supabase, **shared with other unrelated apps** in the `Vam-dashboard` project — every
table is `vis_`-prefixed to keep this app's schema isolated (`vis_audits`, `vis_businesses`,
`vis_campaigns`, `vis_campaign_businesses`, `vis_jobs`, `vis_settings`). Managed via the Supabase
MCP connector's `apply_migration` (not a local migration file) — there is no bootstrap-on-boot step
the way there was with the old local SQLite file.

`lib/db.ts` is a thin `pg`-based compatibility shim, not a real ORM — it exists so the app's
original better-sqlite3-shaped code (`db.prepare(sql).get/.all/.run(...)`) didn't need a full
rewrite when this app moved off local SQLite onto Postgres. It supports both parameter styles the
SQL already uses (positional `?`, named `@word`), auto-appends `RETURNING id` to bare INSERTs so
`.lastInsertRowid` keeps working, and exposes `db.transaction(async (tx) => ...)` for multi-statement
transactions. New code should keep using this shape rather than reaching for raw `pg.Pool` calls.

`vis_jobs.payload` is stored as JSON-encoded TEXT (not `jsonb`) — queries that need to filter on a
payload field use `(payload::json->>'field')::bigint = ?` rather than SQLite's old
`json_extract(payload, '$.field')`.

Tables: `vis_audits` (one per niche+location request), `vis_businesses` (one row per audited
business — mirrors the Business Visibility Auditor sheet schema; `crm_status` is the CRM column),
`vis_campaigns` (one per audit — a named selection of that audit's businesses to pursue),
`vis_campaign_businesses` (join table: `stage` is manual/user-only, never touched by the engine;
`redesign_status`/`redesign_html` and `booking_status`/`booking_link`/`booking_event_type` are
engine-owned), `vis_jobs` (the queue: pending → running → done/error), `vis_settings`.

**CLI contract for manual/debug driving of any job type — always use the CLI, never hand-write SQL
for queue mutations:**

```bash
npm run engine -- pending                                    # list pending jobs + context (JSON)
npm run engine -- claim <jobId>                              # mark running (UI shows progress)
npm run engine -- add-business <auditId> --meta biz.json     # upsert one finished business row
npm run engine -- complete <jobId> [--content file] [--meta meta.json]
npm run engine -- fail <jobId> --message "why"
```

Business fields, campaign summaries, and booking-link meta go through `--meta` JSON files
(scratchpad) — this avoids SQL-escaping entirely. `--content <file>` is for raw, unescaped output
(currently just the redesign mockup HTML — painful to hand-escape into JSON). `add-business`
dedupes on normalized website, then name+location. Read-only inspection queries can go through the
Supabase MCP's `execute_sql` tool (project: Vam-dashboard) — no need for `DATABASE_URL` just to look.

## Settings

`GET`/`PUT /api/settings` (or the `/settings` page) reads/writes the `settings` key/value table.
Currently one key: `calendly_event_type_uri` — which Calendly event type `create_booking_link`
jobs should use for booking links (both the automated engine and the `/run-campaigns` manual
fallback read this same setting). Leave unset and the engine auto-picks via a Claude judgment call
over the connected account's active event types.

## Billing (Stripe) and access control

- One-time access fee and credit top-ups are both Stripe Checkout Sessions created ad-hoc
  (`price_data`, no pre-created Stripe Products needed) — see `lib/pricing.ts` for amounts ($97
  access, $50/$100/$250 credit packs).
- The **only** place that grants `vis_accounts.access_granted` or writes `vis_credits_ledger` is
  the Stripe webhook (`app/api/billing/webhook/route.ts`), which verifies the Stripe signature and
  uses `serviceDb`. Never grant access or add credits from anywhere else, including the engine
  worker or a manual script — the worker only ever *deducts* (see below). `middleware.ts` exempts
  `/api/billing/webhook` from the auth gate the same way it already exempts `/api/engine/run` —
  both are called server-to-server with no browser session, verified by their own signature/secret
  instead.
- Access = `access_granted OR trial_ends_at > now()` — `hasAppAccess()` in `lib/shared.ts`, used
  by both `app/app/layout.tsx` (the paywall gate — redirects to `/billing`) and the billing page
  itself. `app/billing/page.tsx` lives outside the `/app/*` route group specifically so it's never
  itself gated (would be a redirect loop otherwise); it checks for a session directly and redirects
  to `/login` if there isn't one, same as every `(auth)` page.
- **30-day free trial**: `vis_accounts.trial_ends_at`, set once via the `vis_start_trial()`
  Postgres RPC — `SECURITY DEFINER`, callable only by `authenticated`, self-limiting (no-ops if
  `access_granted` is already true or a trial was already started, so it can't be replayed). Also
  grants a **$20 starter credit** (`vis_credits_ledger`, reason `trial_starter_credit`) so the
  trial is actually usable, not a paywall around a paywall. Client calls it via
  `POST /api/billing/start-trial` (`StartTrialButton` in `components/BillingActions.tsx`), which
  runs the RPC through the impersonated `db` connection (not `serviceDb`) — impersonation is what
  makes `auth.uid()` resolve inside the function body, same pattern as
  `vis_create_account_with_owner()` in `app/(auth)/actions.ts`.
- **Credits fund real audit/campaign job cost** — a deliberately different model from a flat
  access-only paywall. `vis_credits_ledger` is append-only (`delta_usd` per row, balance =
  `SUM(delta_usd)`, `lib/billing.ts`'s `getCreditBalance()`/`deductCredits()`). Every `run_audit`/
  `audit_business`/`build_redesign`/`create_booking_link` job the worker completes deducts its own
  real `estimated_cost_usd` (`lib/engine/worker.ts`) — the same number already surfaced on the
  audits/campaigns list badges and the audit trail, now also the thing that actually draws down the
  balance, not just a display figure. `app/api/audits/route.ts` and `app/api/campaigns/route.ts`
  both refuse (`402`) to queue new work once `getCreditBalance(accountId) <= 0` — already-running
  jobs are unaffected, this only blocks starting new ones. A job's cost is only known after the
  Claude call completes, so a single expensive job can push balance slightly negative before the
  block kicks in on the *next* attempt — acceptable, same shape as most usage-based metering.
- **Existing accounts were grandfathered when this shipped** (migration `vis_billing_trial_credits`
  set `access_granted = true` and seeded a $100 credit balance for every account that existed at
  the time) — never assume that's still true for a *future* schema change; recheck before reusing
  this "no backfill breaks existing data" pattern.
- **Usage/cost audit trail**: `/app/audit-trail` (`app/app/audit-trail/page.tsx`) is a read-only
  account activity log — team member add/remove, password changes, Calendly connections, plus
  audit-completed/redesign-built/booking-link-created events, each optionally tagged with a real
  `cost_usd` (`vis_audit_log`, written via `lib/auditLog.ts`'s `logAuditEvent()`). This is a
  *display* of the same spend `vis_credits_ledger` deducts, not a second ledger — `vis_credits_ledger`
  is the one source of truth for "can this account afford to run something," `vis_audit_log` is
  just "what happened and what did it cost."
- **Env vars**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (dashboard.stripe.com → Developers →
  API keys / Webhooks — register `${NEXT_PUBLIC_SITE_URL}/api/billing/webhook` listening for
  `checkout.session.completed`). For local testing:
  `stripe listen --forward-to localhost:3300/api/billing/webhook`.

## Referrals

Every account gets a stable, unique `vis_accounts.referral_code` (auto-generated by column
default, backfilled for existing rows in migration `vis_referrals`). Sharing
`{SITE_URL}/signup?ref=CODE` links a new signup to the referrer; once the referred account
actually **starts its trial** (not just signs up), both sides get a one-time **$10 credit** via
the existing `vis_credits_ledger` — reusing the billing system above rather than building a
second reward mechanism.

- **`vis_referrals`** (one row per referred account, `referred_account_id unique`): `status`
  `'pending' → 'rewarded'`, `reward_usd` (currently a flat `10`), `rewarded_at`. Owner-select RLS
  scoped to `referrer_account_id`, same shape as `vis_credits_ledger`/`vis_payments` — no client
  write policy, the two RPCs below are the only writers.
- **`vis_create_account_with_owner(account_name text, p_referral_code text default null)`** —
  extended (not a new function; the old 1-arg overload was dropped so the existing call site in
  `app/(auth)/actions.ts` resolves to this one via the default param) to resolve the code to a
  referrer account, set `vis_accounts.referred_by_account_id`, and insert a `pending`
  `vis_referrals` row. An unknown/garbage code is a silent no-op — never blocks a real signup
  over a bad referral link, same "never block on a bad optional input" shape as `create_booking_link`'s
  auto-pick fallback.
- **`vis_start_trial()`** — unchanged trial/starter-credit behavior, plus one more step: if the
  account has a `pending` referral, grant `reward_usd` to both `referrer_account_id` and the
  account itself (two `vis_credits_ledger` rows, reasons `referral_reward:referrer:<id>` /
  `referral_reward:referred:<id>`) and flip the referral to `rewarded`. Gated on trial-start
  rather than raw signup deliberately — a reward requires the referred account to actually engage,
  and doesn't depend on Stripe (unlike the access-fee/credit-pack flows above), so referrals work
  even before real Stripe keys are configured.
- **The `?ref=` query param is threaded through, not stored in a cookie/session**: `/signup` reads
  it into a hidden form field; the `signup()` action carries it into both the immediate-session
  redirect and `emailRedirectTo` (so it survives an email-confirmation round trip); `/onboarding`
  carries it from step 1's link into step 2's hidden field; `createAccount()` passes it to the RPC.
  Simple because this app's onboarding is fully server-rendered with no client state to lose it in.
- **UI**: `/app/referrals` (`app/app/referrals/page.tsx` + `components/ReferralLinkCard.tsx`) shows
  the account's own link/code (copy buttons), total earned, and a table of everyone referred with
  pending/rewarded status — all read directly via the impersonated `db` connection, no new API
  route needed (RLS already scopes it correctly).
- **No anti-abuse beyond the reward being gated on trial-start** (no CAPTCHA, no per-IP/device
  cap on signups) — same accepted v1 posture as the rest of this app's pre-launch billing surface
  ("solo testing" reasoning already used elsewhere); revisit before a real public launch.
- **Verified via a rolled-back transaction** against production (fake `auth.users` row +
  `set_config('request.jwt.claims', ...)` impersonation, wrapped in `BEGIN`/`ROLLBACK`) rather
  than a real signup: referral created `pending` on signup, flipped to `rewarded` with both
  `$10` ledger rows written on trial-start, then confirmed zero residue after rollback.

## Platform admin

`/admin` (`app/admin/page.tsx`) is a cross-tenant operator dashboard — not a tenant feature, and
not reachable through the normal `/app/*` cockpit at all (it's a standalone top-level route, same
shape as `/billing`, outside both the `(auth)`/`(marketing)` route groups and `/app/*`'s sidebar
layout).

- **Access control is a dedicated `vis_accounts.is_platform_admin boolean`**, deliberately
  separate from `vis_account_users.role` (`'owner'`/`'member'`), which is scoped to one tenant's
  own account and has no concept of platform-wide privilege. Migration `vis_platform_admin`
  grandfathered the one real account (`id = 1`) to `true`; there is no self-service or UI path to
  set this flag on any other account — it's operator-only, set by hand via `execute_sql`/a
  migration, same trust tier as everything else that bypasses RLS in this app.
- **The page does its own session + admin check**, the same self-gating pattern `/billing` already
  established — `middleware.ts`'s matcher only covers `/app/:path*` and `/api/:path*`, so a
  top-level route like this is never protected by middleware and must check
  `supabaseServerClient().auth.getUser()` itself (redirect `/login`), then read the current
  account's `is_platform_admin` via the impersonated `db` connection and redirect to `/app` if
  false.
- **Every cross-tenant read goes through `serviceDb`** (bypasses RLS by design) — same trust
  boundary as the Team feature's `auth.users` join. Shows: platform-wide stat cards (account
  count, access/trial split, total credit balance, total estimated Claude spend all-time, job
  queue depth by status), a per-account table (members/audits/campaigns/credit balance), and the
  last 20 errored jobs across every tenant (account, type, attempts, error text) — meant for
  spotting a stuck queue or a billing problem (e.g. a dead Anthropic key) before a tenant reports
  it.
- **A real bug caught during verification, not assumed away**: `vis_accounts.created_at`/
  `trial_ends_at` are genuine `timestamptz` columns (unlike `vis_audits`/`vis_jobs`, which store
  these as `TEXT` for historical reasons) — `pg`'s driver returns those as JS `Date` objects, not
  strings, so the naive `.slice(0, 10)` pattern used everywhere else in this codebase threw at
  runtime here. Fixed with `new Date(value).toISOString().slice(0, 10)`. Worth remembering before
  copy-pasting that date-formatting idiom onto any other `timestamptz` column.
- **Sidebar link is conditional**, not a hardcoded route only you know about: `app/app/layout.tsx`
  selects `is_platform_admin` alongside the existing account row and passes it to `Nav.tsx`, which
  renders a distinctly-styled (rose, not indigo) "Admin" link only when true — every other account
  never sees it at all.

## Content rules (non-negotiable)

1. **Never fabricate** emails, phone numbers, ratings, review counts, rankings, or site facts.
   Unverifiable → `not found` / omit, with the attempt noted in `audit_notes`.
2. Emails must be **publicly visible** (site pages, indexed search results, open directory
   listings). Never guess/construct addresses; nothing from behind logins, CAPTCHAs, or paid tools.
3. Every business row cites its `source_urls`.
4. Outreach drafts never promise rankings, revenue, or guaranteed results; regulated industries
   (healthcare, legal, finance) get compliant, outcome-free language.
5. Findings are factual and observable; recommendations are specific, framed as opportunities.
6. Never leave a job stuck in `running` — complete it or fail it with a message. Save each
   business via `add-business` as soon as it's finished so partial progress is never lost.
7. Redesign mockups use original copy and never fabricate customer testimonials; every mockup is
   labeled as a concept, never presented as the business's real site (see `/run-campaigns` for the
   full rules).
8. Booking links are real (created via the connected Calendly account) but the engine never sends
   anything and never books on a prospect's behalf — outreach delivery is a manual, human step.

## Dev

Requires `DATABASE_URL` in the environment (or `.env.local`) — the Supabase Postgres pooled
("Transaction pooler") connection string. Get it from Supabase Dashboard → Vam-dashboard project →
Project Settings → Database → Connection string. Without it, `npm run dev` and `npm run engine`
both fail at the first query, not at startup (the `pg.Pool` constructor doesn't validate eagerly).

```bash
DATABASE_URL="postgres://..." npm run dev        # app on http://localhost:3300
DATABASE_URL="postgres://..." npm run engine -- pending
```

Campaign research/generation needs no other external services when run via `/run-campaigns` —
Claude Code's own web tools handle it, and the Calendly MCP connector already authorized in this
environment handles booking links (no new API keys needed). CSV export (per audit) matches the
Business Visibility Auditor Google Sheets schema exactly, so it imports cleanly into a master
sheet if needed.

The automated engine additionally needs `ANTHROPIC_API_KEY` (a dedicated key with billing
enabled — this makes real, metered Messages API calls including `web_search` at $10/1,000 calls)
and `ENGINE_WEBHOOK_SECRET` (matches the value in Supabase Vault). **`pg_net` can't reach
`localhost`**, so the trigger/cron only ever fire against the deployed Vercel URL — to test the
engine locally, POST directly to `/api/engine/run` with the `x-engine-secret` header yourself,
simulating what Supabase would call.

On Vercel, set `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `ENGINE_WEBHOOK_SECRET` as project
environment variables — see the "Vercel hosts the cockpit and the entire automated engine" note
above for what that does and doesn't mean.
