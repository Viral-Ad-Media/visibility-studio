# Visibility Studio

Next.js cockpit for Supabase business audits, campaign mockups and Calendly booking links. Outreach delivery is manual.

## Development

Use Node.js 22.12 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your own credentials, and run `npm run dev`. Never commit credentials. `DATABASE_URL` must use the application database's privileged server connection; it must never be exposed to a client. Database TLS certificates are verified; provide `DATABASE_CA_CERT` when your provider requires its CA. `DATABASE_SSL=disable` is only for a local database without TLS.

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`. CI runs these checks without live credentials. Database tests use PGlite with a representative legacy schema; they do not prove compatibility with the unexported production schema.

## Database rollout

The repository previously omitted its database migrations. `supabase/migrations/20261005222741_audit_hardening.sql` is an **upgrade for the existing Visibility Studio schema**, not a fresh installation or a complete historical schema snapshot. Its expected legacy objects are documented in `CLAUDE.md` and exercised by `tests/migration.test.ts`.

1. Export the existing `vis_*` table definitions, constraints, triggers, policies, grants and function definitions from the intended **Vam-dashboard** project. Keep the historical schema in version control after checking it for credentials. Check for extra overloads of legacy enqueue, claim, trial and account-creation functions and remove unintended executable variants. Inspect existing column grants as well as table grants.
2. Restore that schema and representative data into an isolated staging database. Review the seeded `vis_platform_admins` user IDs: only owners of previously flagged accounts are seeded, never all account members. Existing trials seed `vis_trial_claims` to prevent reused starter grants. Validate the project's actual ledger/referral triggers against the new atomic trial function.
3. Apply the migration transactionally in staging. Verify owner/member separation, account switching, invitation acceptance, trial replay, paid/unpaid Stripe events, worker retries, and admission reservations against that database. Inspect `pg_net` and `pg_cron`: they must call the engine endpoint with the correct Vault secret, and the backstop must run so abandoned work is reclaimed.
4. Pause job admission and drain old worker invocations before production migration. Apply the verified migration, then deploy this app and worker together. Old workers use the legacy claim function and lack attempt fencing; they must not overlap the new worker. Confirm provider TLS configuration and the 300-second function limit, then resume admission.

The connected Supabase account available during this fix did not include Vam-dashboard. No live database migration or deployment was performed. A clean database cannot yet be provisioned solely from this repository: the historical export above remains required. Roll back the app and database together from a tested backup rather than dropping new structures with active jobs.

## Behavior and operating limits

- Platform authority belongs to explicitly listed users. Account owners manage invitations and removals; acceptance requires a verified email. An account cannot lose its final owner. Members cannot grant themselves ownership through the public API.
- The account menu selects an authorized membership. Tenant queries carry that active account in their database claims. Referral names are fetched through a server query restricted to the current account's referral rows, without granting access to referred accounts.
- Owner trials require a verified email, serialize on the account, retain user trial history, and issue starter/referral credits in one transaction. Shared-account referrals do not earn rewards. These controls do not prevent a person from registering multiple identities; production signup abuse controls remain an operator decision.
- Queue admission checks entitlement and serializes estimated reservations per account. Reservations are $1 for discovery plus $1 per target business, $1 per redesign, and $0.10 per booking job. These are conservative admission estimates, not hard caps on provider usage. Completion deducts measured estimated cost and releases the reservation atomically. Failure releases it after five attempts. Discovery is charged even with no candidates.
- Claimed attempts fence all final artifact, fan-out and billing writes. Six-minute abandoned leases are reclaimed after the 300-second request limit; provider calls have explicit timeouts. A remote provider request can still repeat after a crash before its result is committed; local charges and child jobs remain idempotent. Failed provider calls may incur upstream costs without a usable result.
- Main lists show 50 rows per page. Contacts/Emails filtering and selected CSV exports apply to the displayed page. Use pagination to browse the rest. Polling runs only for active work while the tab is visible.
- The operator CLI requires `VIS_OPERATOR_ACCOUNT_ID`. `claim` only takes pending work and returns its attempt token. `complete` and `fail` require `--attempt`; completion metadata requires measured `estimated_cost_usd` (explicitly use `0` when no provider usage occurred). Completion uses the same transactional artifact/debit logic as the worker. CLI mutations are for a paused or supervised queue; inspection remains read-only.

Sonnet 5 pricing was rechecked against the [official model reference](https://platform.claude.com/docs/en/models/sonnet-5/overview) on October 5, 2026. Recheck token, cache and research-tool rates before changing models. Default calls use standard global pricing; estimates are not a provider invoice reconciliation.

## Supabase Auth configuration on Vercel

If the deployed handler reports “Your project's URL and Key are required”, its build did not receive the Supabase Auth configuration. The homepage can still render because it is static; that does not prove authentication is configured.

In the Vercel `visibility-studio` project, set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (current Supabase key) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (legacy anon key). Both values must come from the **same intended Supabase project** that holds Visibility Studio's database and users. Set them for **Production** and, if used, **Preview**; a Development-only value does not configure a production deployment. The publishable key takes precedence if both are populated. Never put a service-role or secret key into a `NEXT_PUBLIC_` variable.

Redeploy with a new build after saving the values: Next.js inlines public variables when building. The new `vercel.json` uses `npm run build:deploy`, which checks the Auth URL/public key and server DATABASE_URL before building; CI still uses `npm run build` to validate code without production credentials. The proxy returns a non-cacheable 503 and denies access if configuration is missing, rather than throwing the SDK's opaque handler error. This guard does not create configuration values, install the database migration, or replace a live authentication test.

References: [Supabase Next.js setup](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables).

## PostgreSQL configuration on Vercel

`connect ECONNREFUSED 127.0.0.1:5432` means the database client is trying a local PostgreSQL server. When `DATABASE_URL` is missing, `pg` falls back to its default connection settings; Vercel does not run the application database on localhost. The app now validates the connection string before creating a pool, and deployment preflight rejects missing or malformed values without printing credentials. Pool creation is lazy so credential-free CI builds still work.

Open the intended Supabase project, click **Connect**, and copy the **Transaction pooler** connection string for the serverless Vercel app. Replace the password placeholder with the database password, percent-encoding reserved characters. Save it as a **Secret** named `DATABASE_URL` in Vercel Production (and Preview if used), then rebuild. This is a PostgreSQL URI, not the Supabase HTTPS project URL, public API key, or service-role API key. Never expose it under `NEXT_PUBLIC_`. Keep verified TLS enabled; supply `DATABASE_CA_CERT` if the provider certificate needs its CA.

A successful login-page render only verifies the Auth configuration path. After configuring the database, verify an authenticated dashboard request and check that the existing `vis_*` schema and audited migration are present. Do not create a replacement database or apply the upgrade to an empty schema.

Reference: [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Workspace UI

The workspace follows Agentor AI's overview pattern, adapted to local-business prospecting. `/app` is the overview: a data-driven setup checklist, attention links for failed/active audits and selected campaign prospects, discovery/opportunity/outreach totals, current campaign stages, and the five most recent audits. Totals cover the active account through the existing authenticated RLS connection; they are not page totals. Pipeline counts are current stages, not historical conversion rates.

`/app/audits` retains the paginated audit library and adds server-side niche/location/query search and status filtering. Filters survive pagination. The workspace header searches that library, exposes the credit balance and theme toggle, and the sidebar groups discovery, engagement, and workspace tools. Audit details and campaigns still use their existing routes and account permissions. Draft delivery remains manual; this change does not add email sending, paid ad launches, funnel hosting, or social publishing.

Authenticated production UI verification requires the intended database connection and schema. Component previews use explicitly labelled sample data and cannot establish live database connectivity.
