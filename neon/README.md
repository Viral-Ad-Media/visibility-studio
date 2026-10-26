# Neon schema

Neon is the production database. These scripts create and verify the schema on an empty Neon branch. They are not a data migration or a replacement for Clerk session verification.

1. Apply `001_visibility_schema.sql` using a direct PostgreSQL connection and stop on any SQL error. It refuses an existing public vis_* installation.
2. Run `002_rehearsal_checks.sql` with stop-on-error enabled. It creates two synthetic users/accounts, tests RLS and trial behavior as the authenticated role, and rolls back the rows. PostgreSQL sequences may still advance.

The schema preserves the existing application tables and security functions, adds an application user directory and private provider identity map, and replaces Supabase-specific identity helpers. Queue dispatch lives in the app (`lib/engine/dispatch.ts`), not the database, so the schema has no HTTP or cron extensions. Neon Auth objects are not modified.

Verified on an isolated Neon branch: schema creation, authenticated role switching, two-tenant isolation, forged account denial, missing-identity denial, verified trial credits, denied identity-table writes, and test-row rollback. These checks are not a complete production acceptance suite.

## Authentication

Clerk is the only authentication provider. Requests check live session status and the mapped application user's disabled flag. Legacy custom `vis_clerk_session` cookies do not authenticate. Configure `NEXT_PUBLIC_SITE_URL` to the deployment's canonical origin for authorized-party verification.

New verified Clerk users are provisioned transactionally. Imported users with `externalId` or an email matching the existing directory require explicit migration mapping; they are never linked automatically. Test login, signup, recovery, logout, revocation and membership isolation on a preview with its own Clerk instance before changing production keys. Unit tests do not replace this live acceptance check.
