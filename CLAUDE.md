# Visibility Studio

Multi-tenant business-visibility audit SaaS. The Next.js app (deployed on Vercel) is the visual
cockpit; **Supabase (Postgres + Auth) is the database**, with every tenant-owned table scoped by
Row Level Security via `account_id`. Audits (`run_audit`/`audit_business` jobs) are handled by
**an automated Anthropic-API-based worker** (`lib/engine/*`) that drains `vis_jobs` the instant a
row is inserted — no human runs anything. Campaigns (`build_redesign`/`create_booking_link`
jobs — turning a selection of audited businesses into a coded homepage redesign mockup + a real
Calendly booking link per business) are still **human-run via Claude Code** (`/run-campaigns`);
that's Phase C scope, not yet automated. Sending outreach stays a human action either way, outside
this app.

## The automated engine

`run_audit`/`audit_business` jobs process automatically, near-instantly, with no human trigger:

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
  Claude call — and marks the audit `ready`.
- `scripts/engine.ts` (the old `/run-audits` CLI) still exists as a **manual/debug fallback** for
  audits — useful for inspecting a job's context or manually driving/failing something stuck — but
  it is no longer the primary path. It's still the *primary* path for campaigns (see below).

**Vercel hosts the cockpit and the automated audit engine.** Campaign jobs
(`build_redesign`/`create_booking_link`/`backup_audit_csv`) are *not* drained by anything on
Vercel — those still require a human running Claude Code locally with `DATABASE_URL` pointed at
the same Supabase database, via `/run-campaigns`.

## Routes

The app root is a **public marketing site** (`app/(marketing)/` route group — `/`, `/about`,
`/pricing`, `/faq`, `/terms`), pitching Visibility Studio as a product. It has its own layout
(`MarketingNav` + `MarketingFooter`, no sidebar) and is fully static — none of it touches the
database. The actual cockpit (audits, campaigns, settings — everything that used to live at `/`)
now lives under **`/app/*`** (`app/app/`), with its own layout carrying the sidebar `Nav`. Don't
add cockpit pages back at the root, and don't add marketing pages under `/app`.

## The skills

| Skill | Trigger | What it does |
|---|---|---|
| `/run-audits` | manual/debug fallback only — audits now drain automatically, see "The automated engine" | drains pending `run_audit` / `audit_business` jobs by hand — finds businesses in the niche + location, audits each website, scrapes public contact emails, scores 1–5, drafts personalized outreach, and writes each business row back into the DB as it finishes |
| `/run-campaigns` | after creating a campaign, or clicking "Back up to Drive" — still the primary path, not automated | drains pending `build_redesign` / `create_booking_link` / `backup_audit_csv` jobs — builds a self-contained HTML redesign mockup addressing that business's own findings, creates a real single-use Calendly booking link, and backs mockups/audit CSVs up to Google Drive |

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

Tables: `vis_audits` (one per niche+location request; `csv_drive_url`/`csv_drive_backed_up_at`
track the most recent Drive backup), `vis_businesses` (one row per audited business — mirrors the
Business Visibility Auditor sheet schema; `crm_status` is the CRM column), `vis_campaigns` (one per
audit — a named selection of that audit's businesses to pursue), `vis_campaign_businesses` (join
table: `stage` is manual/user-only, never touched by the engine; `redesign_status`/`redesign_html`/
`redesign_drive_url` and `booking_status`/`booking_link`/`booking_event_type` are engine-owned),
`vis_jobs` (the queue: pending → running → done/error), `vis_settings`.

**CLI contract for campaign jobs (still human-run) and manual audit debugging — always use the
CLI, never hand-write SQL for queue mutations:**

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

## Google Drive backups

Google Drive is connected for **archival storage only** — it does not render arbitrary HTML+CSS
as a live webpage, so a Drive-backed redesign mockup link offers the raw file for download, not a
styled preview (the app's own `/api/campaign-businesses/{id}/redesign` route is still the only
place to see it rendered). Audit CSVs, by contrast, convert cleanly to real Google Sheets and
render properly on Drive. There's no delete/update tool on the connector — re-running a backup
always creates a new Drive file rather than replacing the old one; only the most recent link is
tracked (`audits.csv_drive_url` / `campaign_businesses.redesign_drive_url`).

- Redesign mockups back up automatically as part of each `build_redesign` job.
- Audit CSVs back up on demand — click **Back up to Drive** on an audit page, which queues a
  `backup_audit_csv` job for `/run-campaigns` to drain.

## Settings

`GET`/`PUT /api/settings` (or the `/settings` page) reads/writes the `settings` key/value table.
Currently one key: `calendly_event_type_uri` — which Calendly event type `/run-campaigns` should
use for booking links. Leave unset and the skill auto-picks the host's first active event type.

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
Claude Code's own web tools handle it, and the Calendly and Google Drive MCP connectors already
authorized in this environment handle campaigns (no new API keys for either). CSV export (per
audit) matches the Business Visibility Auditor Google Sheets schema exactly, so it imports cleanly
into a master sheet or a backed-up Drive copy.

The automated audit engine additionally needs `ANTHROPIC_API_KEY` (a dedicated key with billing
enabled — this makes real, metered Messages API calls including `web_search` at $10/1,000 calls)
and `ENGINE_WEBHOOK_SECRET` (matches the value in Supabase Vault). **`pg_net` can't reach
`localhost`**, so the trigger/cron only ever fire against the deployed Vercel URL — to test the
engine locally, POST directly to `/api/engine/run` with the `x-engine-secret` header yourself,
simulating what Supabase would call.

On Vercel, set `DATABASE_URL`, `ANTHROPIC_API_KEY`, and `ENGINE_WEBHOOK_SECRET` as project
environment variables — see the "Vercel hosts the cockpit and the automated audit engine" note
above for what that does and doesn't mean.
