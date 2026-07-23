---
name: run-audits
description: Drain pending Visibility Studio jobs — find businesses in the queued niche + location with live web research, audit each website's visibility and conversion signals, scrape public contact emails, score and prioritize, draft personalized outreach, and write every business back into the Postgres database so it appears in the app.
---

# Run queued visibility audits

You are the research engine for the Visibility Studio app in this project. Execute every pending job in the queue. Requires `DATABASE_URL` set (the Supabase Postgres pooled connection string — see CLAUDE.md).

## The job loop

All queue access goes through the engine CLI (never hand-write SQL against the database directly):

1. **List pending work**: `npm run engine -- pending` — prints each job with its context (the audit row plus any businesses already stored for it, for dedupe).
2. For each job, **claim it**: `npm run engine -- claim <jobId>` (marks it running so the UI shows progress).
3. Do the research (rules below) and **write each business as soon as it's done**:
   write the fields to a scratchpad JSON file, then
   `npm run engine -- add-business <auditId> --meta /path/business.json`
   — the UI live-updates row by row, and a crash never loses finished work. The upsert
   dedupes on website (then name+location), so re-running is safe.
4. **Complete the job**:
   - `run_audit`: write a short markdown summary (top 3 opportunities, emails found vs not, outreach drafts generated, limitations hit) to a file, then
     `npm run engine -- complete <jobId> --meta /path/meta.json` with meta shaped `{"summary_md": "..."}`.
   - `audit_business`: `npm run engine -- complete <jobId> --meta /path/business.json` (the meta is the business fields; the row is upserted for you).
5. If a job cannot be completed (e.g. search fully blocked), `npm run engine -- fail <jobId> --message "<why>"` — never leave a job stuck in `running`. Partial results already saved via `add-business` are kept.
6. When the queue is drained, report a summary: businesses audited, emails found, outreach drafted, top priority opportunities.

## Business meta shape

All fields optional except `name`. Omit anything unverified rather than guessing.

```json
{
  "name": "Smile Dental Dallas",
  "category": "dentist",
  "location": "Dallas, TX",
  "website": "https://…",
  "maps_url": "https://…",
  "phone": "…",
  "email": "info@… or 'not found'",
  "rating": "4.7",
  "review_count": "212",
  "source_urls": ["https://…", "https://…"],
  "homepage_headline": "…",
  "main_cta": "call | book | quote form | none visible",
  "seo_score": 3,
  "conversion_score": 2,
  "trust_score": 4,
  "opportunity_score": 4,
  "priority": "High",
  "visibility_issues": "- …\n- …",
  "website_improvements": "- …",
  "local_seo_opportunities": "- …",
  "content_opportunities": "- …",
  "outreach_angle": "one-line hook based on the biggest observed gap",
  "outreach_subject": "under 9 words, specific",
  "outreach_email": "full 4-6 short-paragraph email",
  "audit_notes": "caveats, blocked pages, assumptions"
}
```

## Research methodology (Business Visibility Auditor)

If the `anthropic-skills:business-visibility-auditor` skill is available, invoke it and follow it — it is the authoritative methodology (its references cover the audit framework, scoring rubric, and outreach templates). The rules below are the load-bearing subset and apply regardless:

**Discovery** (WebSearch / WebFetch / browser):
- Search `[category] in [location]`, `best [category] [location]`, `[category] near [location]`; use maps/local-pack results and directories as secondary sources.
- Target the audit's `target_count`; skip businesses already in `existing_businesses` (from the job context) unless refreshing them.
- Prioritize businesses with an active website; include weak/no-website businesses only when useful for outreach.
- If the audit's `notes` list specific businesses or websites, audit those directly instead of searching.

**Evidence standards — never fabricate**:
- Never invent emails, phone numbers, ratings, review counts, rankings, or site facts. Unverifiable field → omit it or write `not found` (emails) and note the attempt in `audit_notes`.
- Record only **publicly visible** emails, in this priority order: contact/about/team/footer pages → homepage scan → web search (`"[name]" "[city]" email`) → directory listings. Prefer contact/info/hello@ over personal addresses. Never guess or construct addresses; never take emails from behind login walls, CAPTCHAs, or paid tools.
- Cite the URLs actually used per business in `source_urls`.

**Website audit** — check visible signals only: title/headline clarity; local SEO (city/service terms, service + location pages, schema clues, GBP consistency); conversion elements (CTAs, phone buttons, forms, booking); credibility (reviews, certifications, team/about); UX (mobile, navigation, popups, broken pages); technical basics (HTTPS, headings, meta description, thin pages).

**Scoring** — 1–5 for SEO Visibility, Website Conversion, Local Trust, Opportunity. Priority: `High` = meaningful revenue potential + obvious gaps; `Medium` = moderate impact or fit; `Low` = already strong or data too thin.

**Recommendations** — specific and practical ("create `[service] + [city]` pages", "add sticky call button on mobile"), never generic. No guarantees ("rank #1"); frame as likely improvements.

**Outreach** (High and Medium priority only):
- Subject under 9 words, specific to the observed gap.
- Body 4–6 short paragraphs: hook → specific problem → value → soft CTA → sign-off.
- Must reference a concrete finding; never "I noticed your website could be improved."
- No promises of rankings, revenue, or guaranteed results. Regulated industries (healthcare, legal, finance): compliant language, no outcome claims.
- Email found → address it to that contact; otherwise use `[Contact Name]` placeholder.

**Quality check before completing each job**: every row has sources · no fabricated contact data · scores follow the rubric · High/Medium rows have outreach drafts · limitations noted, not hidden.

## Single-business jobs

For `audit_business` jobs, the payload carries `audit_id` and a `website` (and maybe `name`). Skip discovery — audit that one site end to end and complete with the business meta.
