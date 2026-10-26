# Visibility Studio

Next.js cockpit for business audits, campaign mockups and Calendly booking links. Outreach delivery is manual.

## Development

Use Node.js 22.12 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your own credentials, and run `npm run dev`. Never commit credentials. `DATABASE_URL` must use the application database's privileged server connection; it must never be exposed to a client. Database TLS certificates are verified; provide `DATABASE_CA_CERT` when your provider requires its CA. `DATABASE_SSL=disable` is only for a local database without TLS.

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`. CI runs these checks without live credentials. Database tests run the Neon schema (`neon/001_visibility_schema.sql`) in PGlite. They verify tenant isolation and the onboarding, trial, audit, campaign and worker contracts.

## Database

Production runs on **Neon** PostgreSQL, with authentication by **Clerk**. The schema is `neon/001_visibility_schema.sql`: it runs in one transaction, refuses an existing `vis_*` installation, and creates the application tables, the `vis_users` directory, the private Clerk identity map, membership policies, column grants, onboarding/trial functions and the audited queue functions. `neon/002_rehearsal_checks.sql` is a rolled-back authorization smoke test. See `neon/README.md`.

The original Supabase project was retired in October 2026 after its data was imported into Neon. Supabase Auth, Vault, `pg_net` and `pg_cron` are no longer used anywhere in the app. Roll back the app and database together from a tested Neon backup or branch, rather than dropping structures with active jobs.

## Behavior and operating limits

- Platform authority belongs to explicitly listed users. Account owners manage invitations and removals; acceptance requires a verified email. An account cannot lose its final owner. Members cannot grant themselves ownership through the public API.
- The account menu selects an authorized membership. Tenant queries carry that active account in their database claims. Referral names are fetched through a server query restricted to the current account's referral rows, without granting access to referred accounts.
- Owner trials require a verified email, serialize on the account, retain user trial history, and issue starter/referral credits in one transaction. Shared-account referrals do not earn rewards. These controls do not prevent a person from registering multiple identities; production signup abuse controls remain an operator decision.
- Queue admission checks entitlement and serializes estimated reservations per account. Reservations are $1 for discovery plus $1 per target business, $1 per redesign, and $0.10 per booking job. These are conservative admission estimates, not hard caps on provider usage. Completion deducts measured estimated cost and releases the reservation atomically. Provider failures release it after two attempts; exhausted reclaimed jobs stop before making another provider call. Discovery is charged even with no candidates.
- Claimed attempts fence all final artifact, fan-out and billing writes. Six-minute abandoned leases are reclaimed after the 300-second request limit; provider calls have explicit timeouts. A remote provider request can still repeat after a crash before its result is committed; local charges and child jobs remain idempotent. Failed provider calls may incur upstream costs without a usable result.
- Main lists show 50 rows per page. Contacts/Emails filtering and selected CSV exports apply to the displayed page. Use pagination to browse the rest. Polling runs only for active work while the tab is visible.
- The operator CLI requires `VIS_OPERATOR_ACCOUNT_ID`. `claim` only takes pending work and returns its attempt token. `complete` and `fail` require `--attempt`; completion metadata requires measured `estimated_cost_usd` (explicitly use `0` when no provider usage occurred). Completion uses the same transactional artifact/debit logic as the worker. CLI mutations are for a paused or supervised queue; inspection remains read-only.

Sonnet 5 pricing was rechecked against the [official model reference](https://platform.claude.com/docs/en/models/sonnet-5/overview) on October 5, 2026. Recheck token, cache and research-tool rates before changing models. Default calls use standard global pricing; estimates are not a provider invoice reconciliation.

## Clerk configuration on Vercel

Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the same Clerk instance (both `live` or both `test`) for each Vercel environment that serves users, and set `NEXT_PUBLIC_SITE_URL` to that deployment's canonical origin. Next.js inlines public variables at build time, so redeploy after changing them. `vercel.json` builds with `npm run build:deploy`, which checks the Clerk keys and `DATABASE_URL` without printing them. The proxy returns a non-cacheable 503 and denies access if the Clerk configuration is missing. Sign-in, sign-up, password recovery and account security are Clerk's hosted components (`/login`, `/signup`, `/app/security`).

## PostgreSQL configuration on Vercel

`connect ECONNREFUSED 127.0.0.1:5432` means `DATABASE_URL` is missing and `pg` fell back to localhost. The app validates the connection string before creating a pool, and deployment preflight rejects missing or malformed values without printing credentials. Pool creation is lazy so credential-free CI builds still work.

Use Neon's **pooled** connection string (the `-pooler` host) as a **Secret** named `DATABASE_URL` in Vercel Production (and Preview if used), then rebuild. Never expose it under `NEXT_PUBLIC_`. Neon's certificate is publicly trusted, so leave `DATABASE_CA_CERT` unset; a CA for another provider makes TLS verification fail.

## Automated worker setup

Each `/api/engine/run` call processes one job. The app wakes the engine itself (`lib/engine/dispatch.ts`): routes that queue jobs wake it after responding, and each engine run wakes the next while claimable work remains, keeping at most three runs in flight. The wake-up is a short `POST` with the `x-engine-secret` header to `NEXT_PUBLIC_SITE_URL` (or the Vercel production URL); Vercel keeps the engine running after the caller hangs up. A daily Vercel cron (`vercel.json`, `GET /api/engine/run`) is the backstop for a job whose run died with nothing else queued; it only runs when `CRON_SECRET` is set on the project.

In Vercel Production, configure `ANTHROPIC_API_KEY` and a random `ENGINE_WEBHOOK_SECRET` of at least 32 characters, then rebuild. Verify job attempts/status and the engine's response codes after configuration.

## API usage controls

Business research allows at most 3 searches and 3 page fetches, with 2,048 research output tokens and 1,536 submission tokens. Discovery allows at most 4 searches. Submission uses only the findings tool, and missing source URLs can be recovered solely from provider citations or successfully fetched pages. Research and submission timeouts are 200 and 40 seconds, below the 300-second function limit. Provider failures retry at most once; jobs reclaimed after two attempts do not call providers again.

Each audit stops new research once its **completed-job estimated usage** reaches $5. This is an admission safeguard, not a hard provider invoice ceiling: concurrent in-flight requests can exceed it, and failed/timed-out provider requests may be charged upstream without reported usage. The testing credit ledger is separate from actual Anthropic funds. Set an organization or non-default workspace spend limit in Claude Console for an enforced monthly ceiling; do not rely on the $500 testing balance to restrict the provider account.

## Clerk migration

The [Clerk migration plan](docs/auth/clerk-migration.md) records how existing UUIDs, memberships and transaction-scoped RLS were preserved when authentication moved from Supabase Auth to Clerk. Imported users keep their original UUID through the identity map; new verified Clerk users are provisioned on first sign-in.
