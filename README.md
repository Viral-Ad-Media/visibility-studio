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
