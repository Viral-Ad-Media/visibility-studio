-- Read-only preparation. Run against an authorized staging clone first.
-- Produces aggregate counts and app schema definitions, never password values.
BEGIN TRANSACTION READ ONLY;

SELECT count(*) AS membership_rows, count(DISTINCT user_id) AS member_users,
       count(DISTINCT account_id) AS accounts_with_members
FROM public.vis_account_users;

SELECT count(*) AS orphan_memberships
FROM public.vis_account_users m LEFT JOIN auth.users u ON u.id = m.user_id
WHERE u.id IS NULL;

SELECT count(*) AS accounts_without_owner
FROM public.vis_accounts a
WHERE NOT EXISTS (SELECT 1 FROM public.vis_account_users m
                  WHERE m.account_id = a.id AND m.role = 'owner');

-- This population is a starting scope, not a blanket export authorization.
WITH scoped AS (
  SELECT DISTINCT user_id FROM public.vis_account_users
  UNION SELECT user_id FROM public.vis_platform_admins
  UNION SELECT invited_by FROM public.vis_team_invites
  UNION SELECT user_id FROM public.vis_trial_claims
)
SELECT count(*) AS referenced_auth_users,
       count(*) FILTER (WHERE u.email_confirmed_at IS NULL) AS unverified_email,
       count(*) FILTER (WHERE coalesce(u.encrypted_password, '') = '') AS no_password,
       count(*) FILTER (WHERE u.encrypted_password ~ '^\$2[aby]\$') AS bcrypt_format,
       count(*) FILTER (WHERE coalesce(u.encrypted_password, '') <> ''
                        AND u.encrypted_password !~ '^\$2[aby]\$') AS other_password_format,
       count(*) FILTER (WHERE u.banned_until > now()) AS currently_banned
FROM auth.users u JOIN scoped s ON s.user_id = u.id;

SELECT i.provider, count(DISTINCT i.user_id) AS member_users
FROM auth.identities i
WHERE EXISTS (SELECT 1 FROM public.vis_account_users m WHERE m.user_id = i.user_id)
GROUP BY i.provider ORDER BY i.provider;

-- Locate every app-owned foreign key into auth.users, including cascade rules.
SELECT c.conrelid::regclass AS source_table, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
  AND n.nspname = 'public' AND left(t.relname, 4) = 'vis_'
ORDER BY 1, 2;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND left(tablename, 4) = 'vis_'
ORDER BY tablename, policyname;

-- Source definitions are needed to identify email-verification dependencies.
SELECT p.oid::regprocedure AS function_name, p.prosecdef AS security_definer,
       p.proconfig AS settings, p.proacl AS grants, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND left(p.proname, 4) = 'vis_' AND p.prokind = 'f'
ORDER BY 1;

ROLLBACK;
