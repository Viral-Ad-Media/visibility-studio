# Visibility Studio

Next.js cockpit for Supabase business audits, campaign mockups and Calendly booking links. Outreach delivery is manual.

## Development

Use Node.js 22.12 or newer. Run `npm ci`, copy `.env.example` to `.env.local`, fill in your own credentials, and run `npm run dev`. Never commit credentials. `DATABASE_URL` must use the application database's privileged server connection; it must never be exposed to a client. Database TLS certificates are verified; provide `DATABASE_CA_CERT` when your provider requires its CA. `DATABASE_SSL=disable` is only for a local database without TLS.

Run `npm test`, `npm run typecheck`, `npm run build`, and `npm audit`. CI runs these checks without live credentials. Database tests use PGlite for both the legacy upgrade fixture and the complete fresh installer. They verify tenant isolation and the onboarding, trial, audit, campaign and worker contracts.

## Database rollout

The repository previously omitted its database migrations. `supabase/migrations/20261005222741_audit_hardening.sql` is an **upgrade for the existing Visibility Studio schema**, not a fresh installation or a complete historical schema snapshot. Its expected legacy objects are documented in `CLAUDE.md` and exercised by `tests/migration.test.ts`.

1. Export the existing `vis_*` table definitions, constraints, triggers, policies, grants and function definitions from the intended **Vam-dashboard** project. Keep the historical schema in version control after checking it for credentials. Check for extra overloads of legacy enqueue, claim, trial and account-creation functions and remove unintended executable variants. Inspect existing column grants as well as table grants.
2. Restore that schema and representative data into an isolated staging database. Review the seeded `vis_platform_admins` user IDs: only owners of previously flagged accounts are seeded, never all account members. Existing trials seed `vis_trial_claims` to prevent reused starter grants. Validate the project's actual ledger/referral triggers against the new atomic trial function.
3. Apply the migration transactionally in staging. Verify owner/member separation, account switching, invitation acceptance, trial replay, paid/unpaid Stripe events, worker retries, and admission reservations against that database. Inspect `pg_net` and `pg_cron`: they must call the engine endpoint with the correct Vault secret, and the backstop must run so abandoned work is reclaimed.
4. Pause job admission and drain old worker invocations before production migration. Apply the verified migration, then deploy this app and worker together. Old workers use the legacy claim function and lack attempt fencing; they must not overlap the new worker. Confirm provider TLS configuration and the 300-second function limit, then resume admission.

### Fresh installation

For an intentionally new project with no public `vis_*` tables, execute the entire `supabase/bootstrap/20261008213333_fresh_install.sql` file in the Supabase SQL Editor. It runs in one transaction and refuses existing installations. It creates all 16 application tables, parent-derived tenant IDs, membership policies, safe column grants, onboarding and trial functions, and the audited queue functions. Existing `auth.users` are preserved. It already includes the security upgrade: **do not run the legacy upgrade again**.

The bootstrap is deliberately outside the legacy migration stream because that upgrade requires existing tables. Do not run bare `supabase db push` against an empty project or a bootstrapped project without first reconciling its migration history with the already-applied upgrade. Preserve the recorded bootstrap migration in any future schema/history export.

On October 8, 2026, the owner authorized a fresh installation in project `nmzspgajflxbruotxoce` (visibility-studio). The installer was applied as migration `20261008213752_fresh_install`. The live database has 16 RLS-enabled tables and the original login user; an impersonated onboarding transaction succeeded and was rolled back.

After installation, sign in and create a workspace. The verified owner can start a trial from Billing. No platform administrator, workspace, or paid access is seeded. Configure Anthropic, engine webhook authentication and dispatch/backstop scheduling before expecting queued work to run; Stripe and Calendly need their respective integration configuration. The bootstrap does not create provider credentials or worker scheduling.

For an existing installation, follow the upgrade procedure above. Roll back the app and database together from a tested backup rather than dropping structures with active jobs.

## Behavior and operating limits

- Platform authority belongs to explicitly listed users. Account owners manage invitations and removals; acceptance requires a verified email. An account cannot lose its final owner. Members cannot grant themselves ownership through the public API.
- The account menu selects an authorized membership. Tenant queries carry that active account in their database claims. Referral names are fetched through a server query restricted to the current account's referral rows, without granting access to referred accounts.
- Owner trials require a verified email, serialize on the account, retain user trial history, and issue starter/referral credits in one transaction. Shared-account referrals do not earn rewards. These controls do not prevent a person from registering multiple identities; production signup abuse controls remain an operator decision.
- Queue admission checks entitlement and serializes estimated reservations per account. Reservations are $1 for discovery plus $1 per target business, $1 per redesign, and $0.10 per booking job. These are conservative admission estimates, not hard caps on provider usage. Completion deducts measured estimated cost and releases the reservation atomically. Provider failures release it after two attempts; exhausted reclaimed jobs stop before making another provider call. Discovery is charged even with no candidates.
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

A successful login-page render only verifies the Auth configuration path. After configuring the database, verify an authenticated dashboard request and check that the existing `vis_*` schema and audited migration are present. For an authorized fresh project, use the complete bootstrap above; the legacy upgrade alone cannot initialize an empty schema.

Reference: [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres).

## Automated worker setup

After the fresh bootstrap (or existing-schema upgrade), apply `supabase/migrations/20261008215237_engine_automation.sql` once. This enables pg_net and pg_cron, installs a private insert trigger and a one-minute backstop, and throttles wakeups to one every 15 seconds. Dispatch skips idle queues and missing credentials. The URL is pinned to the production Visibility Studio endpoint to prevent credential forwarding.

In Vercel Production, configure `ANTHROPIC_API_KEY` and a random `ENGINE_WEBHOOK_SECRET` of at least 32 characters, then rebuild. In Supabase Vault, create `vis_engine_webhook_url` with `https://visibility-studio-tau.vercel.app/api/engine/run` and `vis_engine_webhook_secret` with the **same value** as Vercel's `ENGINE_WEBHOOK_SECRET`. Set credentials privately in the dashboards; never commit them or include them in logs. Production webhook URL was provisioned during setup; the owner must supply the matching Vault secret. Vercel Secret values cannot be retrieved after saving.

Verify `cron.job`, job attempts/status and worker response codes after configuration. A scheduled run returning successfully only proves the scheduler executed; verify the HTTP response and actual queue progress separately. The automation integration test mocks pg_net and checks missing configuration, URL pinning, throttling and denied client execution.

## API usage controls

Business research allows at most 3 searches and 3 page fetches, with 2,048 research output tokens and 1,536 submission tokens. Discovery allows at most 4 searches. Submission uses only the findings tool, and missing source URLs can be recovered solely from provider citations or successfully fetched pages. Research and submission timeouts are 200 and 40 seconds, below the 300-second function limit. Provider failures retry at most once; jobs reclaimed after two attempts do not call providers again.

Each audit stops new research once its **completed-job estimated usage** reaches $5. This is an admission safeguard, not a hard provider invoice ceiling: concurrent in-flight requests can exceed it, and failed/timed-out provider requests may be charged upstream without reported usage. The testing credit ledger is separate from actual Anthropic funds. Set an organization or non-default workspace spend limit in Claude Console for an enforced monthly ceiling; do not rely on the $500 testing balance to restrict the provider account.

Fresh installations also require `20261008220320_derive_worker_job_account.sql` after the bootstrap so worker discovery can insert child jobs with ownership derived from their persisted targets. The production Vault secret is now configured and dispatch has been verified with HTTP 200 responses.
