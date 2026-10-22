-- Synthetic authorization checks. Rehearsal branch only; all rows rolled back.
BEGIN;
INSERT INTO public.vis_users(id,email,email_confirmed_at) VALUES ('00000000-0000-4000-8000-000000000001','owner-a@example.invalid',now()),('00000000-0000-4000-8000-000000000002','owner-b@example.invalid',now());
INSERT INTO public.vis_accounts(id,name) VALUES (900001,'Rehearsal A'),(900002,'Rehearsal B');
INSERT INTO public.vis_account_users(account_id,user_id,role) VALUES (900001,'00000000-0000-4000-8000-000000000001','owner'),(900002,'00000000-0000-4000-8000-000000000002','owner');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","vis_account_id":900001}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.vis_accounts)<>1 OR NOT EXISTS(SELECT 1 FROM public.vis_accounts WHERE id=900001) THEN RAISE EXCEPTION 'tenant isolation failed'; END IF; END $$;
SELECT public.vis_start_trial_for_account(900001);
DO $$ BEGIN IF (SELECT sum(delta_usd) FROM public.vis_credits_ledger WHERE account_id=900001)<>20 THEN RAISE EXCEPTION 'trial credit failed'; END IF; IF has_table_privilege(current_user,'vis_private.identity_map','INSERT') OR has_table_privilege(current_user,'public.vis_users','UPDATE') THEN RAISE EXCEPTION 'identity write exposed'; END IF; END $$;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","vis_account_id":900002}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.vis_accounts) THEN RAISE EXCEPTION 'forged account visible'; END IF; END $$;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM public.vis_accounts) THEN RAISE EXCEPTION 'anonymous account visible'; END IF; END $$;
ROLLBACK;
