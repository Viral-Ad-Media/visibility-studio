import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, it, expect } from 'vitest';
let pg: PGlite;
const owner='00000000-0000-0000-0000-000000000001';
const other='00000000-0000-0000-0000-000000000002';
async function user(id=owner, account?: number) {
 await pg.exec('RESET ROLE');
 await pg.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role:'authenticated',vis_account_id:account})]);
 await pg.exec('SET ROLE authenticated');
}
beforeAll(async()=>{
 pg=new PGlite();
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
 CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 GRANT USAGE ON SCHEMA auth TO authenticated,anon;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated,anon;
 INSERT INTO auth.users VALUES('${owner}','owner@example.com',now()),('${other}','other@example.com',now());`);
 await pg.exec(readFileSync('supabase/bootstrap/20261008213333_fresh_install.sql','utf8'));
});
afterAll(async()=>{await pg?.close();});
it('supports fresh onboarding, trial, audit, campaign and job creation with tenant isolation',async()=>{
 await user();
 const aid=Number((await pg.query<{id:number}>("SELECT vis_create_account_guarded('First',null) id")).rows[0].id);
 await expect(pg.query("SELECT vis_create_account_guarded('Duplicate',null)")).rejects.toThrow('you already own an account');
 await user(other);
 const bid=Number((await pg.query<{id:number}>("SELECT vis_create_account_guarded('Second',null) id")).rows[0].id);
 await user(owner,aid);
 expect((await pg.query('SELECT id FROM vis_accounts')).rows).toEqual([{id:aid}]);
 expect((await pg.query('SELECT account_id FROM vis_account_users')).rows).toEqual([{account_id:aid}]);
 await pg.query('SELECT vis_start_trial_for_account($1)',[aid]);
 await pg.query('SELECT vis_start_trial_for_account($1)',[aid]);
 expect((await pg.query("SELECT delta_usd FROM vis_credits_ledger WHERE reason='trial_starter_credit'")).rows).toEqual([{delta_usd:'20'}]);
 const audit=Number((await pg.query<{id:number}>("INSERT INTO vis_audits(account_id,query,category,location,target_count) VALUES($1,'query','dentist','Boston',2) RETURNING id",[aid])).rows[0].id);
 await expect(pg.query("INSERT INTO vis_audits(account_id,query,category,location) VALUES($1,'x','x','x')",[bid])).rejects.toThrow('row-level security');
 const campaign=Number((await pg.query<{id:number}>("INSERT INTO vis_campaigns(audit_id,name) VALUES($1,'Campaign') RETURNING id",[audit])).rows[0].id);
 await pg.exec('RESET ROLE');
 const business=Number((await pg.query<{id:number}>("INSERT INTO vis_businesses(audit_id,name) VALUES($1,'Business') RETURNING id",[audit])).rows[0].id);
 await user(owner,aid);
 await pg.query('INSERT INTO vis_campaign_businesses(campaign_id,business_id) VALUES($1,$2)',[campaign,business]);
 expect((await pg.query('SELECT account_id FROM vis_campaign_businesses')).rows).toEqual([{account_id:aid}]);
 await pg.query("INSERT INTO vis_settings(account_id,key,value) VALUES($1,'theme','dark') ON CONFLICT(account_id,key) DO UPDATE SET value=excluded.value RETURNING account_id",[aid]);
 await pg.query("SELECT vis_enqueue_job_guarded('run_audit',$1)",[audit]);
 await expect(pg.query("SELECT vis_enqueue_job_guarded('run_audit',$1)",[audit])).rejects.toThrow('already_queued');
 for (const sql of ['UPDATE vis_accounts SET access_granted=true','DELETE FROM vis_account_users','UPDATE vis_jobs SET status=\'done\'','SELECT access_token FROM vis_calendly_connections','SELECT vis_claim_job_v2()']) {
  await expect(pg.query(sql)).rejects.toThrow('permission denied');
 }
 await user(other,bid);
 expect((await pg.query('SELECT * FROM vis_audits')).rows).toHaveLength(0);
 await expect(pg.query("INSERT INTO vis_campaigns(audit_id,name) VALUES($1,'Foreign')",[audit])).rejects.toThrow('parent_not_found');
 await expect(pg.query("SELECT vis_enqueue_job_guarded('run_audit',$1)",[audit])).rejects.toThrow('unauthorized');
 await pg.exec('RESET ROLE');
 expect((await pg.query('SELECT * FROM vis_claim_job_v2()')).rows).toHaveLength(1);
 await expect(pg.exec(readFileSync('supabase/bootstrap/20261008213333_fresh_install.sql','utf8'))).rejects.toThrow('Existing Visibility Studio tables');
 await pg.exec('ROLLBACK');
 expect((await pg.query('SELECT count(*)::int n FROM auth.users')).rows[0]).toEqual({n:2});
});
