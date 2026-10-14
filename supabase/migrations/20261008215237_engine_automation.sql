-- Server-only queue dispatch. Credentials are supplied separately through Vault.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE TABLE vis_private.engine_dispatch_state (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), last_sent_at timestamptz
);
ALTER TABLE vis_private.engine_dispatch_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vis_private.engine_dispatch_state FROM PUBLIC,anon,authenticated;
INSERT INTO vis_private.engine_dispatch_state(id) VALUES(true);
CREATE FUNCTION vis_private.dispatch_engine() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE endpoint text; secret text; request_id bigint;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.vis_jobs WHERE status='pending' OR
   (status='running' AND updated_at::timestamptz < now()-interval '6 minutes')) THEN RETURN NULL; END IF;
 SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='vis_engine_webhook_url';
 SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='vis_engine_webhook_secret';
 IF endpoint IS NULL OR secret IS NULL OR length(secret)<32 THEN RETURN NULL; END IF;
 -- Prevent a changed Vault URL from forwarding the engine credential elsewhere.
 IF endpoint <> 'https://visibility-studio-tau.vercel.app/api/engine/run' THEN RAISE EXCEPTION 'invalid_engine_endpoint'; END IF;
 UPDATE vis_private.engine_dispatch_state SET last_sent_at=now()
 WHERE id AND (last_sent_at IS NULL OR last_sent_at < now()-interval '15 seconds');
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-engine-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=300000) INTO request_id;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION vis_private.dispatch_engine() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION vis_private.on_job_inserted() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM vis_private.dispatch_engine();
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION vis_private.on_job_inserted() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER on_vis_job_inserted AFTER INSERT ON public.vis_jobs
FOR EACH STATEMENT EXECUTE FUNCTION vis_private.on_job_inserted();
SELECT cron.schedule('vis-engine-drain-backstop','* * * * *','SELECT vis_private.dispatch_engine();');
