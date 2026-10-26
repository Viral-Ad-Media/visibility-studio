# Clerk migration preparation

Status (October 2026): historical. Data now lives in Neon, Clerk is the only auth provider, and the Supabase project and its preflight script have been removed. The plan below is kept as the record of how identities were carried over; its Supabase-side steps no longer apply.

Target application: `app_3KznnRH1c2kJHBTDR0DU8bs7kKc` (selected by the owner). Keep Supabase PostgreSQL. Preserve all existing application UUIDs, account IDs, memberships, ownership, trial claims, ledger entries, audits, campaigns, and integrations.

## Findings from the repository

- `proxy.ts` verifies Supabase sessions for `/app/*` and `/api/*`; engine and Stripe webhook endpoints have their own authentication.
- `lib/db.ts` verifies a user, chooses a membership using the untrusted `vis_account_id` cookie only as a preference, then sets transaction-local claims and `SET LOCAL ROLE authenticated`. RLS runs on every normal query. This is direct PostgreSQL access, not browser PostgREST access.
- `vis_account_users.user_id`, `vis_platform_admins.user_id`, and `vis_team_invites.invited_by` reference `auth.users`. Trial claims also retain UUIDs. Live schema inventory must confirm additional dependencies.
- `vis_start_trial_for_account` reads `auth.users.email_confirmed_at`. Team listing joins `auth.users`. Invitation acceptance uses a verified email from Supabase.
- Auth actions include signup, signin, signout, password change/recovery, and account creation. Settings, admin, billing checkout, and Calendly callback also read Supabase users.
- Supabase is a shared platform in the historical documentation. README identifies the intended Visibility Studio project as `nmzspgajflxbruotxoce`; confirm the actual deployment target before any operation. Do not migrate unrelated users merely because they exist in the same Auth schema.

## Identity architecture

Introduce application-owned `public.vis_users` with `id uuid primary key`, current primary email, verification timestamp, and disabled timestamp. Existing IDs are copied exactly; new users receive a generated UUID. Email is profile data, never the identity key or authorization authority.

Introduce a private identity map keyed by `(provider, issuer, subject)`, pointing to `vis_users.id`. A unique constraint on `(provider, issuer, user_id)` prevents accidental duplicate identities within an instance. No browser SELECT/INSERT/UPDATE/DELETE grants. No anonymous or authenticated execution grants on provisioning helpers. Use a narrowly scoped server-only lookup; never a general browser API for editing mappings.

For Clerk imports, `externalId` is the original Supabase UUID. Record the returned Clerk user ID with its exact instance issuer in the map. Do not authorize from client metadata, email matching, a cookie, or an unverified external-ID claim. Cross-instance subjects and missing/disabled mappings fail closed. An existing authenticated Supabase UUID gets its own mapping only through the controlled backfill.

At runtime, a server authentication adapter verifies the selected provider, resolves its identity to the application UUID, and returns `{ appUserId, provider, providerUserId, verifiedEmail }`. Clerk session validation must check signature, expiry, issuer and authorized parties using the supported server SDK. Use request-scoped caching only. Disabled identities must be rejected; define and test session revocation behavior with the SDK and Clerk configuration.

`lib/db.ts` continues to supply the **mapped UUID** as `sub`, and the validated account as `vis_account_id`, on the same connection and transaction as the query. Retain `SET LOCAL ROLE authenticated`, parameter binding, rollback, and pool cleanup. Do not pass Clerk's `user_...` subject to `auth.uid()` and do not replace normal queries with service-role queries.

This server bridge deliberately does not enable Clerk tokens for direct Supabase Data API access. If Storage, Realtime or browser PostgREST is added later, it needs a separate issuer-aware RLS design; the server UUID bridge is not automatically applied there. Existing Supabase direct-access grants remain subject to existing policies and must be inventoried and tested.

## Database changes to implement after preflight

1. Add `vis_users` and the private identity map; backfill scoped users and verification state. Preserve disabled/banned/deleted state. Avoid exposing password hashes in this schema.
2. Repoint only Visibility Studio's foreign keys from `auth.users` to `vis_users` after validating every reference. Keep the source Auth rows for rollback. Explicitly retain deletion behavior where appropriate; provider deletion must disable an identity, not cascade-delete business data.
3. Change team email joins and the trial verification lookup to `vis_users`. Keep existing UUID predicates, active-account restrictions, ownership checks, one-trial history, and account locking.
4. Give `vis_users` no general client-write privileges. Add only the exact read access required by existing functions, or narrowly scoped functions. Verify SECURITY DEFINER ownership, search_path, and EXECUTE grants.
5. Keep a Supabase-era adapter release that reads the new directory before switching auth. This becomes the rollback release. Old code that joins `auth.users` cannot safely serve new Clerk-only users.
6. Synchronize profile and verification changes through a verified Clerk webhook plus server reconciliation. Verify webhook signatures, deduplicate event IDs, reject stale events, and prevent reassignment of existing mappings. Webhooks cannot grant membership, owner/admin roles, paid access or credits. Handle revocation/deletion promptly and retain audit history.

No schema change is executable yet: the dependency inventory must determine exact constraints/functions and permissions. Do not alter global `auth.uid()`, shared Auth tables, or unrelated applications.

## Import and credential continuity

- First run `scripts/auth/clerk-preflight.sql` against a staging clone with the application schema. It is read-only and reports counts and schema definitions, not password values, emails or tokens. Review scope for users with no membership separately; include pending onboarders only with evidence they belong to Visibility Studio.
- Select the **production instance** of the chosen Clerk application for the real import. Rehearse with synthetic users in development; development users are not a production migration. Verify app ID, instance issuer, domain and key environment before importing.
- An authorized operator exports only approved users through a secure channel. Keep encrypted exports outside git and logs, restrict access, and define deletion/retention dates. Do not read existing environment files. Configure secrets privately in deployment settings.
- Import via Clerk Backend API (or the official migration tool), preserving UUID as `externalId`. Inspect actual password algorithms: import compatible bcrypt hashes using `passwordDigest`/`passwordHasher`; unsupported, missing or damaged hashes need a verified recovery flow. Never request or store plaintext passwords.
- Preserve email verification accurately. Backend createUser verifies identifiers by default; explicitly reserve unverified identifiers using the current API's identification-status options. Never turn an unverified legacy address into a verified one. Preserve bans/locks and evaluate MFA/passkey/SSO compatibility; do not silently drop security requirements.
- Inventory OAuth providers from `auth.identities` and production settings. Configure matching provider credentials, consent screens and callback URLs in Clerk. Rehearse linking by established provider identity. Do not automatically link by matching email alone, especially unverified email. Existing provider tokens and Supabase sessions are not assumed transferable. Users may need to sign in again or reconnect.
- Import in bounded batches with rate-limit backoff and a durable restricted manifest of source UUID, destination ID, issuer, status and timestamp. On retry, reconcile by external ID and map before creating; conflicts stop for review. Never overwrite another user's identity to resolve an email collision.
- Reconcile source population, successful imports, disabled/excluded users and maps exactly. Compare account membership tuples `(account_id, user_id, role)` and trial/ledger counts before and after. No ownership or billing reset is part of import.

## Application implementation map

| Area | Required adaptation |
| --- | --- |
| `proxy.ts` | Provider-specific verification; protect cockpit/API, preserve webhook exceptions, deny missing configuration. Do not silently fall back to Supabase when Clerk verification fails. |
| `lib/db.ts` | Resolve verified provider identity to existing UUID; retain transaction-local RLS and membership-based selection. |
| `lib/api.ts` | Return 401 for absent/invalid session, 403 for denied membership; no secret or SDK error leakage. |
| `app/(auth)/actions.ts`, auth pages, `/auth/confirm` | Clerk signin/signup/logout/recovery; preserve safe local redirects and referral onboarding. Keep old recovery callback only during a bounded legacy grace period. |
| `app/layout.tsx`, navigation | ClerkProvider inside body, shadcn-themed Clerk controls, existing app account switcher. Do not substitute Clerk Organizations for existing memberships. |
| `app/api/account/route.ts`, team API | Use mapped UUID and provider-verified email; maintain lock/owner checks and verified invitation acceptance. |
| Settings, admin, billing pages and checkout | Use normalized identity; retain platform-admin and paid-access checks. Preserve existing Stripe customer/account linkage. |
| Calendly callback | Resolve mapped user/account with the same state validation and tenant binding. Existing stored tokens remain account-owned. |
| Deployment preflight | Require correct provider-specific public/server configuration, issuer and app/instance binding without printing values. Keep server secrets out of NEXT_PUBLIC variables. |

Implement a server-only `VIS_AUTH_PROVIDER=supabase|clerk` setting (not present yet). One provider governs a deployment; no ambiguous dual-session precedence. Use an isolated staging deployment for Clerk testing. During any production canary, pin cohort routing server-side; never let a request header or cookie choose its provider.

## Rollout and rollback

1. Inventory live schema and scoped user counts; back up database and membership manifest; verify restore on staging. Confirm production Clerk instance, OAuth/MFA requirements and session policy.
2. Ship additive directory/map changes and the Supabase adapter first. Validate existing login, invitation, trial and database behavior. This is a required checkpoint before importing real users.
3. Rehearse import with synthetic password/OAuth/unverified/banned users, then run the acceptance matrix below. Keep production on Supabase.
4. Schedule a brief identity-change freeze (signup, password/email changes and linking), perform final delta import and reconciliation, then cut over the configured production auth provider. Business data and queue processing need not be reset. Maintain an explicit handling path for incomplete imports; do not silently create duplicate accounts.
5. Require reauthentication into Clerk. Expire application legacy cookies and revoke legacy Supabase sessions as agreed; deleting browser cookies alone does not revoke refresh tokens. Existing access JWTs can remain valid until expiry. Keep old verification/recovery links only for the documented transition window; they must not bypass Clerk after cutover.
6. Monitor signin failures, unmapped identities, invitation denials, RLS failures and cross-account probes. Stop rollout on any unexpected authorization result or mismatched membership reconciliation. Do not log tokens/password hashes.
7. Rollback before cutover: use the Supabase adapter release; leave additive tables and imports intact. Rollback after cutover requires explicit user reconciliation: new Clerk-only users have no legacy password, and post-cutover password/email changes are not synced back automatically. Pause new registrations, provide a verified recovery/provisioning path for that cohort, and preserve maps and business data. Do not claim rollback is just flipping a flag or deleting Clerk users.
8. Retire legacy auth only after the rollback window, expired legacy access tokens, reconciliation, and verified recovery paths. Keep UUIDs and audit records permanently. Never delete legacy Auth rows while cascade dependencies remain.

## Acceptance gates

| Test | Required result |
| --- | --- |
| Existing password user imports and signs in | Same UUID, accounts, roles, history, credit balance and trial history |
| OAuth, MFA, unverified, banned and no-password users | Documented continuity/recovery; no verification or security downgrade |
| Missing/wrong-issuer/replayed/expired token; absent mapping | Denied; no Supabase fallback or provisioning by email |
| Manipulated account cookie / another tenant's resource ID | No data exposure or mutation |
| Member attempts owner/admin operation or last-owner removal | Denied; original membership safeguards preserved |
| Verified invitation acceptance; unverified invitation attempt | Correct membership only for verified email; unverified denied |
| Retry/replay import, signup or webhook | One identity mapping; no duplicate membership/trial/credit |
| Pooled concurrent requests for two users/accounts | No cross-request role or claim leakage, including rollback/error paths |
| Removed member or disabled identity with existing session | Access denied according to tested revocation policy |
| Direct Supabase REST/RPC calls | Existing RLS enforced; Clerk tokens not accepted by the server-only bridge |
| Stripe/engine callbacks and Calendly reconnect | Existing verification and tenant binding preserved |
| Rollback with post-cutover users/password changes | Rehearsed recovery without lost users or business data |

## Operator handoff

Before commands that target the selected Clerk application, the owner authenticates locally:

```sh
npx -y clerk@latest auth login
```

After the migration implementation and reviewed staging setup exist, use the chosen application explicitly; do not create an accountless replacement. Do not run init in this preparation phase, because it could overwrite the existing authentication. No keys need to be pasted into chat. Remaining inputs: confirmed production instance/domain, authoritative user scope, OAuth/MFA settings, cutover window and rollback retention period.

## References checked 2026-10-21

- https://clerk.com/docs/guides/development/migrating/overview
- https://clerk.com/docs/reference/backend/user/create-user
- https://github.com/clerk/migration-tool
- https://supabase.com/docs/guides/auth/third-party/clerk

These references describe provider capabilities; the UUID bridge and staged directory migration above are this project's proposed architecture, not an off-the-shelf Clerk migration.
