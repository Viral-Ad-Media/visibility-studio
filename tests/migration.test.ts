import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";

let pg: PGlite;
const owner = "00000000-0000-0000-0000-000000000001";
const member = "00000000-0000-0000-0000-000000000002";
// Representative legacy schema, not a substitute for a production schema export.
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated,anon; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated,anon;
    INSERT INTO auth.users VALUES ('${owner}','owner@example.com',now()),('${member}','member@example.com',now());
    CREATE TABLE vis_accounts(id bigint primary key,name text,is_platform_admin bool default false,access_granted bool default false,trial_ends_at timestamptz,updated_at timestamptz);
    CREATE TABLE vis_account_users(id serial primary key,account_id bigint references vis_accounts,user_id uuid references auth.users,role text,created_at timestamptz default now(), unique(account_id,user_id));
    CREATE TABLE vis_audits(id bigint primary key,account_id bigint,target_count int,status text,error text,updated_at text,query text,category text,location text,notes text);
    CREATE TABLE vis_businesses(id serial primary key,account_id bigint,crm_status text,updated_at text);
    CREATE TABLE vis_campaigns(id serial primary key,account_id bigint,audit_id bigint);
    CREATE TABLE vis_campaign_businesses(id bigint primary key,account_id bigint,campaign_id bigint,business_id bigint,stage text,redesign_status text,redesign_error text,booking_status text,booking_error text,updated_at text);
    CREATE TABLE vis_jobs(id serial primary key,account_id bigint,type text,payload text,status text default 'pending',attempts int default 0,result text,updated_at text default now()::text);
    CREATE TABLE vis_credits_ledger(id serial primary key,account_id bigint,delta_usd numeric,reason text);
    CREATE TABLE vis_payments(id serial primary key,account_id bigint);
    CREATE TABLE vis_referrals(id serial primary key,referrer_account_id bigint,referred_account_id bigint,status text,reward_usd numeric,rewarded_at timestamptz);
    CREATE FUNCTION vis_start_trial() RETURNS void LANGUAGE sql AS $$ SELECT $$;
    CREATE FUNCTION vis_create_account_with_owner(text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 7::bigint $$;
    CREATE FUNCTION vis_enqueue_job(text,bigint) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
    CREATE FUNCTION vis_claim_job() RETURNS setof vis_jobs LANGUAGE sql AS $$ SELECT * FROM vis_jobs LIMIT 1 $$;
    INSERT INTO vis_accounts VALUES(7,'Admin',true,true,null,now()),(8,'Other',false,true,null,now());
    INSERT INTO vis_account_users(account_id,user_id,role) VALUES(7,'${owner}','owner'),(7,'${member}','member'),(8,'${owner}','member');
    GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated,anon;
    GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated,anon;
    CREATE FUNCTION public.is_member(bigint) RETURNS bool LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.vis_account_users WHERE account_id=$1 AND user_id=auth.uid()) $$;
    DO $$ DECLARE t text; BEGIN FOR t IN SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='account_id' LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
      EXECUTE format('CREATE POLICY vis_tenant_isolation ON %I FOR ALL TO authenticated USING (public.is_member(account_id)) WITH CHECK (public.is_member(account_id))',t);
    END LOOP; END $$;
    ALTER TABLE vis_accounts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tenant ON vis_accounts TO authenticated USING(public.is_member(id)) WITH CHECK(public.is_member(id));`);
  await pg.exec(
    readFileSync(
      "supabase/migrations/20261005222741_audit_hardening.sql",
      "utf8",
    ),
  );
});
afterAll(async () => {
  await pg?.close();
});
beforeEach(async () => {
  await pg.exec(`RESET ROLE; SELECT set_config('request.jwt.claims','{}',false); DELETE FROM vis_jobs; DELETE FROM vis_credits_ledger; DELETE FROM vis_audits;
    UPDATE vis_accounts SET access_granted=true;
    INSERT INTO vis_audits(id,account_id,target_count,status,error,updated_at) VALUES(70,7,2,'queued',null,null),(80,8,2,'queued',null,null);
    INSERT INTO vis_credits_ledger(account_id,delta_usd,reason) VALUES(7,5,'seed'),(8,5,'seed');`);
});
async function asUser(userId = owner, accountId = 7) {
  await pg.query("SELECT set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({
      sub: userId,
      role: "authenticated",
      vis_account_id: accountId,
    }),
  ]);
  await pg.exec("SET ROLE authenticated");
}
it("grants platform authority to individual owners, excluding invited members", async () => {
  expect(
    (await pg.query("SELECT user_id FROM vis_platform_admins")).rows,
  ).toEqual([{ user_id: owner }]);
  await asUser(member);
  await expect(pg.query("SELECT * FROM vis_platform_admins")).rejects.toThrow(
    "permission denied",
  );
});
it("blocks direct membership, billing, queue and generated-artifact mutations", async () => {
  await asUser();
  for (const sql of [
    "DELETE FROM vis_account_users",
    "UPDATE vis_accounts SET access_granted=true",
    "INSERT INTO vis_credits_ledger(account_id,delta_usd) VALUES(7,100)",
    "UPDATE vis_jobs SET status='done'",
    "UPDATE vis_campaign_businesses SET redesign_status='ready'",
    "SELECT vis_claim_job_v2()",
    "SELECT vis_enqueue_job('run_audit',70)",
  ]) {
    await expect(pg.query(sql)).rejects.toThrow("permission denied");
  }
});
it("reserves credits and refuses duplicate or oversubscribed queue entries", async () => {
  await asUser();
  await pg.query("SELECT vis_enqueue_job_guarded('run_audit',70)");
  await expect(
    pg.query("SELECT vis_enqueue_job_guarded('run_audit',70)"),
  ).rejects.toThrow("already_queued");
  await pg.exec(
    "RESET ROLE; INSERT INTO vis_audits(id,account_id,target_count,status,error,updated_at) VALUES(71,7,2,'queued',null,null); SET ROLE authenticated",
  );
  await expect(
    pg.query("SELECT vis_enqueue_job_guarded('run_audit',71)"),
  ).rejects.toThrow("insufficient_available_credits");
});
it("selects an authorized secondary account and isolates other memberships", async () => {
  await asUser(owner, 8);
  expect((await pg.query("SELECT id FROM vis_audits")).rows).toEqual([
    { id: 80 },
  ]);
  await pg.query("SELECT vis_enqueue_job_guarded('run_audit',80)");
  await expect(
    pg.query("SELECT vis_enqueue_job_guarded('run_audit',70)"),
  ).rejects.toThrow("unauthorized");
});
it("rejects jobs after entitlement expires and reclaims exhausted leases", async () => {
  await pg.exec("UPDATE vis_accounts SET access_granted=false WHERE id=7");
  await asUser();
  await expect(
    pg.query("SELECT vis_enqueue_job_guarded('run_audit',70)"),
  ).rejects.toThrow("access_required");
  await pg.exec(
    `RESET ROLE; INSERT INTO vis_jobs(account_id,type,payload,status,attempts,updated_at,reserved_usd) VALUES(7,'run_audit','{"audit_id":70}','running',5,(now()-interval '10 minutes')::text,3); SELECT vis_claim_job_v2();`,
  );
  expect(
    (await pg.query("SELECT status,reserved_usd FROM vis_jobs")).rows[0],
  ).toEqual({ status: "error", reserved_usd: "0" });
  expect(
    (await pg.query("SELECT status FROM vis_audits WHERE id=70")).rows[0],
  ).toEqual({ status: "error" });
});

it("starts an owner trial once and never grants rewards for a shared-account referral", async () => {
  await pg.exec(
    "UPDATE vis_accounts SET access_granted=false,trial_ends_at=null WHERE id=7; INSERT INTO vis_referrals(referrer_account_id,referred_account_id,status,reward_usd) VALUES(8,7,'pending',10)",
  );
  await asUser();
  await pg.query("SELECT vis_start_trial_for_account(7)");
  await pg.query("SELECT vis_start_trial_for_account(7)");
  await pg.exec("RESET ROLE");
  expect(
    (
      await pg.query(
        "SELECT * FROM vis_credits_ledger WHERE reason='trial_starter_credit'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await pg.query(
        "SELECT * FROM vis_credits_ledger WHERE reason LIKE 'referral_reward:%'",
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(member);
  await expect(
    pg.query("SELECT vis_start_trial_for_account(7)"),
  ).rejects.toThrow("unauthorized");
});
