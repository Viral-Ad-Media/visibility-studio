# Neon schema rehearsal

These scripts prepare and verify an empty isolated Neon branch. They are not a production data migration or a replacement for Clerk session verification.

1. Apply `001_visibility_schema.sql` using a direct PostgreSQL connection and stop on any SQL error. It refuses an existing public vis_* installation.
2. Run `002_rehearsal_checks.sql` with stop-on-error enabled. It creates two synthetic users/accounts, tests RLS and trial behavior as the authenticated role, and rolls back the rows. PostgreSQL sequences may still advance.

The schema preserves the existing application tables and security functions, adds an application user directory and private provider identity map, and replaces Supabase-specific identity helpers. It intentionally excludes Supabase Vault, HTTP dispatch and cron integration. Neon Auth objects are not modified.

Verified on an isolated Neon branch: schema creation, authenticated role switching, two-tenant isolation, forged account denial, missing-identity denial, verified trial credits, denied identity-table writes, and test-row rollback. These checks are not a complete production acceptance suite.

Outstanding: live schema comparison, data import/reconciliation and sequence alignment; verified Clerk adapter and provisioning; application joins currently referencing auth.users; portable queue dispatch and recovery; pooled-request isolation tests; production configuration and controlled cutover. Do not point the application at this schema yet. A matching schema build is not evidence of migrated customer data.
