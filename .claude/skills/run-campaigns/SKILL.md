---
name: run-campaigns
description: Manual/debug fallback for Visibility Studio's campaign jobs — build_redesign and create_booking_link now drain automatically in production (see CLAUDE.md, "The automated engine"). Use this skill to inspect a job's context or manually drive/fail something stuck. For each business added to a campaign, builds a coded homepage redesign mockup addressing that business's own audit findings and generates a real Calendly booking link, writing results back into Postgres so they appear in the app.
---

# Run queued campaign jobs (manual/debug fallback)

`build_redesign` and `create_booking_link` jobs process automatically in production via
`lib/engine/worker.ts` — no human runs anything under normal operation. Use this skill only to
inspect a job's context or manually drive/fail something stuck. Requires `DATABASE_URL` set (the
Supabase Postgres pooled connection string — see CLAUDE.md).

## The job loop

All queue access goes through the engine CLI (never hand-write SQL against the database directly):

1. **List pending work**: `npm run engine -- pending` — prints every pending job with context.
   For campaign jobs the context includes `business` (the full audited business row — scores,
   findings, headline, CTA) and `campaign_business` (current stage/statuses).
2. **Claim it**: `npm run engine -- claim <jobId>` — flips the matching status
   (`redesign_status` or `booking_status`) to `running` so the UI shows progress.
3. Do the work (rules below).
4. **Complete it**:
   - `build_redesign`: write the full mockup to a scratchpad `.html` file, then
     `npm run engine -- complete <jobId> --content /path/mockup.html`.
   - `create_booking_link`: write `{"booking_link": "...", "booking_event_type": "..."}` to a
     scratchpad `.json` file, then
     `npm run engine -- complete <jobId> --meta /path/meta.json`.
5. If a job can't be completed, `npm run engine -- fail <jobId> --message "<why>"` — never leave
   a job stuck in `running`.
6. When the queue is drained, report a summary: mockups built, booking links created, and the
   campaign(s) they belong to.

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
