-- Worker discovery creates child jobs using payload.audit_id. Derive ownership
-- from the persisted audit, rather than trusting a payload account identifier.
CREATE FUNCTION vis_private.derive_job_account() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE aid bigint; body jsonb;
BEGIN
 body:=NEW.payload::jsonb;
 IF NEW.type IN ('run_audit','audit_business') THEN
  SELECT account_id INTO aid FROM public.vis_audits WHERE id=(body->>'audit_id')::bigint;
 ELSIF NEW.type IN ('build_redesign','create_booking_link') THEN
  SELECT account_id INTO aid FROM public.vis_campaign_businesses WHERE id=(body->>'campaign_business_id')::bigint;
 ELSE RAISE EXCEPTION 'invalid_job_type'; END IF;
 IF aid IS NULL THEN RAISE EXCEPTION 'job_target_not_found'; END IF;
 IF NEW.account_id IS NOT NULL AND NEW.account_id<>aid THEN RAISE EXCEPTION 'job_account_mismatch'; END IF;
 NEW.account_id:=aid;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vis_private.derive_job_account() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER vis_jobs_derive_account BEFORE INSERT ON public.vis_jobs
FOR EACH ROW EXECUTE FUNCTION vis_private.derive_job_account();
