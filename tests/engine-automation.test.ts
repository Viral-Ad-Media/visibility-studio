import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {it,expect} from 'vitest';
it('keeps dispatch private, requires matching configuration, pins destination and throttles wakeups',async()=>{
 const pg=new PGlite();
 try {
 await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA vis_private; CREATE SCHEMA vault; CREATE SCHEMA net; CREATE SCHEMA cron;
 CREATE TABLE public.vis_jobs(status text,updated_at text); INSERT INTO public.vis_jobs VALUES('pending',now()::text);
 CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
 CREATE TABLE net.sent_requests(id serial,url text);
 CREATE FUNCTION net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE rid bigint; BEGIN INSERT INTO net.sent_requests(url) VALUES(url) RETURNING id INTO rid; RETURN rid; END $$;
 CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;`);
 await pg.exec(readFileSync('supabase/migrations/20261008215237_engine_automation.sql','utf8').replace(/^CREATE EXTENSION.*$/gm,''));
 expect((await pg.query('SELECT vis_private.dispatch_engine() id')).rows).toEqual([{id:null}]);
 await pg.exec("INSERT INTO vault.decrypted_secrets VALUES('vis_engine_webhook_url','https://visibility-studio-tau.vercel.app/api/engine/run'),('vis_engine_webhook_secret',repeat('x',32))");
 expect((await pg.query('SELECT vis_private.dispatch_engine() id')).rows).toEqual([{id:1}]);
 expect((await pg.query('SELECT vis_private.dispatch_engine() id')).rows).toEqual([{id:null}]);
 await pg.exec("UPDATE vault.decrypted_secrets SET decrypted_secret='https://other.example/worker' WHERE name='vis_engine_webhook_url'");
 await expect(pg.query('SELECT vis_private.dispatch_engine()')).rejects.toThrow('invalid_engine_endpoint');
 expect((await pg.query("SELECT has_function_privilege('authenticated','vis_private.dispatch_engine()','execute') allowed")).rows).toEqual([{allowed:false}]);
 expect((await pg.query("SELECT has_function_privilege('anon','vis_private.dispatch_engine()','execute') allowed")).rows).toEqual([{allowed:false}]);
 } finally {await pg.close();}
});
