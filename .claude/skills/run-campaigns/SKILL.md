---
name: run-campaigns
description: Drain pending Visibility Studio campaign jobs — for each business added to a campaign, build a coded homepage redesign mockup addressing that business's own audit findings, generate a real Calendly booking link, and back mockups/audit CSVs up to Google Drive. Writes results back into the Postgres database so they appear in the app.
---

# Run queued campaign jobs

You are the engine for Visibility Studio's campaign phase and its Drive backups. Execute every
pending `build_redesign`, `create_booking_link`, and `backup_audit_csv` job in the queue. Requires
`DATABASE_URL` set (the Supabase Postgres pooled connection string — see CLAUDE.md).

## The job loop

All queue access goes through the engine CLI (never hand-write SQL against the database directly):

1. **List pending work**: `npm run engine -- pending` — prints every pending job with context.
   For campaign jobs the context includes `business` (the full audited business row — scores,
   findings, headline, CTA) and `campaign_business` (current stage/statuses).
2. **Claim it**: `npm run engine -- claim <jobId>` — flips the matching status
   (`redesign_status` or `booking_status`) to `running` so the UI shows progress.
   `backup_audit_csv` jobs have no status column to flip — just claim and proceed.
3. Do the work (rules below).
4. **Complete it**:
   - `build_redesign`: write the full mockup to a scratchpad `.html` file, upload it to Drive
     (rules below), then
     `npm run engine -- complete <jobId> --content /path/mockup.html --meta /path/meta.json`
     where meta is `{"drive_url": "<the Drive file's webViewLink>"}` — `drive_url` is optional;
     if the Drive upload fails, still complete the job with just `--content` so the mockup shows
     up in the app, and mention the backup failure in your summary rather than failing the job.
   - `create_booking_link`: write `{"booking_link": "...", "booking_event_type": "..."}` to a
     scratchpad `.json` file, then
     `npm run engine -- complete <jobId> --meta /path/meta.json`.
   - `backup_audit_csv`: `npm run engine -- export-csv <auditId> > /path/audit.csv`, upload it to
     Drive (rules below), then
     `npm run engine -- complete <jobId> --meta /path/meta.json` where meta is
     `{"drive_url": "<the Drive file's webViewLink>"}` (required — fail the job if the upload
     itself fails, since there's nothing else for this job to do).
5. If a job can't be completed, `npm run engine -- fail <jobId> --message "<why>"` — never leave
   a job stuck in `running`.
6. When the queue is drained, report a summary: mockups built, booking links created, CSVs backed
   up, and the campaign(s)/audit(s) they belong to.

## Drive backups (`build_redesign` and `backup_audit_csv` jobs)

Google Drive is connected for archival/backup storage only — **it does not render arbitrary
HTML+CSS as a live webpage.** Opening a Drive link to an uploaded mockup offers the raw file for
download/source view, not a styled page (unlike Docs/Sheets, Drive has no "publish as a rendered
page" for arbitrary HTML). Never describe a Drive-backed mockup link to the user as a "shareable
preview" — the interactive, correctly-rendered view is the app's own
`/api/campaign-businesses/{id}/redesign` route. Drive's job here is just: keep an off-machine copy.

- **Mockup HTML** (`build_redesign`): `create_file` with `content_mime_type: "text/html"` and
  `disable_conversion_to_google_type: true` — converting to a Google Doc would strip all the CSS,
  making the backup less useful than the raw file. Title it something like
  `"{Business Name} — Homepage Concept — {date}"`.
- **Audit CSV** (`backup_audit_csv`): `create_file` with `content_mime_type: "text/csv"` and
  **leave conversion enabled** (omit `disable_conversion_to_google_type`, or set it `false`) — CSV
  → Google Sheets is a real, well-supported conversion and gives a properly rendered, sortable
  sheet, unlike the HTML case. Title it `"{audit query} — Audit Backup — {date}"`.
- There's no delete/update tool on the Drive connector — re-running a backup (regenerating a
  mockup, or backing up an audit again) creates a **new** Drive file rather than replacing the old
  one. Only the most recent link is tracked in the app; older backups remain in Drive untracked.
  Don't try to work around this — it's an accepted limitation of the "backup archive" framing.

## Redesign mockups (`build_redesign` jobs)

Ground every change in that specific business's own findings from the job's `business` context —
`visibility_issues`, `website_improvements`, `homepage_headline`, `main_cta`. This is a concept
pitch, not a generic template: if "no address/phone visible" was a finding, the mockup shows them
prominently; if "no clear CTA" was a finding, the mockup has an obvious one; if the finding was a
broken/thin homepage, the mockup demonstrates what a real one looks like for that category of
business.

**Hard rules**:
- Write **original copy** — never lift the business's real photos or body text verbatim
  (copyright/trust reasons). Use clean CSS/typography-driven design instead of fabricated stock
  photography; real business name, address, category, and phone are fine to use since they're
  factual and already public.
- **Never invent customer testimonials or review quotes.** If social proof is called for, use a
  generic pattern ("see our reviews on Google") rather than a fake named quote — a fabricated
  testimonial is a trust-destroying detail if the prospect ever notices.
- Every mockup gets a small, unobtrusive footer line — something like *"Concept mockup by
  [sender] — not the business's live site"* — so it's never mistaken for the real thing.
- Invoke `anthropic-skills:artifact-design` for the actual visual craft: real content, a palette
  and type pairing grounded in the business's actual category (a barbershop and a roofing company
  should not look the same), no lorem ipsum.
- This is a single self-contained HTML file (inline `<style>`, no external assets/CDNs) — it's
  served raw via an API route with no app chrome, so it must be a complete page on its own
  (`<!DOCTYPE html>`, `<html>`, `<head>` with a `<title>`, `<body>`).

## Booking links (`create_booking_link` jobs)

Follow the Calendly MCP's own grounding order:

1. `users-get_current_user` first, to ground the host.
2. Check `vis_settings` for a `calendly_event_type_uri` — read it via the Supabase MCP's
   `execute_sql` tool (`SELECT value FROM vis_settings WHERE key='calendly_event_type_uri'`,
   against the Vam-dashboard project) rather than a raw `psql`/engine call; it's read-only and
   doesn't need `DATABASE_URL`. If set, use that event type directly.
3. If unset, call `event_types-list_event_types` (filtered to the host) and **do not just grab the
   first active one** — inspect each candidate's `custom_questions` and `description`. A real
   account is likely to have event types built for a completely different funnel (e.g. an
   AI-agency coaching/mastermind calendar with investment-budget qualifying questions), which
   would be actively wrong to hand to a cold local-business prospect. Prefer a short (15–30 min),
   simple event type with no more than a name/email/phone-style custom question. **If nothing
   suitable exists, don't force it** — `fail` the job with a clear message naming what's missing
   (e.g. "no generic discovery-call event type; only coaching-funnel event types exist") and
   suggest the user create one and set `calendly_event_type_uri` in Settings.
4. Call `scheduling_links-create_single_use_scheduling_link` for the chosen event type to get a
   real, single-use booking URL.
5. Complete the job with `{"booking_link": "<the URL>", "booking_event_type": "<event type name>"}`
   — recording which event type was used lets the user catch a wrong pick via Settings.

Never send anything and never book on the prospect's behalf — this job only *creates a link* for
the human to send later; sending outreach stays a manual, human action outside this app entirely.
