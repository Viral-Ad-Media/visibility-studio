# Visibility Studio

Business-visibility audit studio. The Next.js app is the visual cockpit — deployed on Vercel, with
a Postgres database on Supabase — and **Claude Code is the engine**, run locally against that same
remote database, draining the `jobs` queue in two phases. Phase 1 audits businesses using live web
research (WebSearch/WebFetch/browser) and the Business Visibility Auditor methodology
(`anthropic-skills:business-visibility-auditor` — invoke it when available; `/run-audits` embeds
the load-bearing rules as a fallback). Phase 2 turns a selection of audited businesses into a
**campaign**: a coded homepage redesign mockup and a real Calendly booking link per business,
tracked through a manual pipeline up to the point of sending (sending stays a human action, outside
this app).

**Vercel hosts the cockpit; it does not run the engine.** Nothing on Vercel drains the jobs queue,
does web research, or calls Calendly/Drive — that only happens when a human runs Claude Code
locally with `DATABASE_URL` pointed at the same Supabase database the deployed app uses. The UI is
shared; the engine invocation is not.

## The skills

| Skill | Trigger | What it does |
|---|---|---|
| `/run-audits` | after queuing an audit in the app | drains pending `run_audit` / `audit_business` jobs — finds businesses in the niche + location, audits each website, scrapes public contact emails, scores 1–5, drafts personalized outreach, and writes each business row back into the DB as it finishes |
| `/run-campaigns` | after creating a campaign, or clicking "Back up to Drive" | drains pending `build_redesign` / `create_booking_link` / `backup_audit_csv` jobs — builds a self-contained HTML redesign mockup addressing that business's own findings, creates a real single-use Calendly booking link, and backs mockups/audit CSVs up to Google Drive |

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

**Engine contract — always use the CLI, never hand-write SQL for queue mutations:**

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

Research/generation work needs no other external services — Claude Code's own web tools handle
audits, and the Calendly and Google Drive MCP connectors already authorized in this environment
handle campaigns (no new API keys for either). CSV export (per audit) matches the Business
Visibility Auditor Google Sheets schema exactly, so it imports cleanly into a master sheet or a
backed-up Drive copy.

On Vercel, set the same `DATABASE_URL` as a project environment variable — see the "Vercel hosts
the cockpit" note above for what that does and doesn't mean.
