BEGIN;
CREATE TABLE IF NOT EXISTS public.project_security_settings(
 project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
 require_production_approval boolean NOT NULL DEFAULT false,updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.secret_rotation_schedules(
 secret_id uuid PRIMARY KEY REFERENCES public.secrets(id) ON DELETE CASCADE,
 next_rotation_at timestamptz,interval_days integer CHECK(interval_days BETWEEN 1 AND 3650),
 last_rotated_at timestamptz,updated_by uuid,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shroud_private.production_change_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
 requested_by uuid NOT NULL,entries jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','applied','rejected','cancelled')),
 reviewed_by uuid,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',reviewed_at timestamptz
);
CREATE TABLE IF NOT EXISTS shroud_private.production_write_permits(tx bigint NOT NULL,environment_id uuid NOT NULL,actor_id uuid NOT NULL,PRIMARY KEY(tx,environment_id));
ALTER TABLE shroud_private.production_change_requests ADD COLUMN IF NOT EXISTS source_token_id uuid;
CREATE TABLE IF NOT EXISTS shroud_private.vercel_connections(
 project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
 vercel_project_id text NOT NULL,vercel_team_id text,encrypted_token text NOT NULL,updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),last_synced_at timestamptz,last_environment_id uuid
);
ALTER TABLE public.project_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secret_rotation_schedules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_security_settings,public.secret_rotation_schedules FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA shroud_private FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.project_security_settings,public.secret_rotation_schedules TO authenticated;
DROP POLICY IF EXISTS settings_read ON public.project_security_settings;
CREATE POLICY settings_read ON public.project_security_settings FOR SELECT TO authenticated USING(public.is_project_member(project_id));
DROP POLICY IF EXISTS rotation_read ON public.secret_rotation_schedules;
CREATE POLICY rotation_read ON public.secret_rotation_schedules FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id WHERE s.id=secret_id AND public.is_project_member(e.project_id)));

CREATE OR REPLACE FUNCTION shroud_private.assert_project(p_project uuid,p_write boolean DEFAULT false,p_manage boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid;
BEGIN
 SELECT p.team_id INTO v_team FROM public.projects p
 JOIN public.project_members pm ON pm.project_id=p.id AND pm.user_id=auth.uid()
 JOIN public.team_members tm ON tm.team_id=p.team_id AND tm.user_id=auth.uid()
 WHERE p.id=p_project AND (NOT p_write OR pm.role IN ('owner','admin','developer')) AND (NOT p_manage OR pm.role IN ('owner','admin'));
 IF v_team IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 RETURN v_team;
END $$;

CREATE OR REPLACE FUNCTION shroud_private.guard_production() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_env uuid; v_type public.environment_type; v_actor uuid := coalesce(nullif(current_setting('shroud.actor_id',true),'')::uuid,auth.uid());
BEGIN
 IF TG_TABLE_NAME='environments' THEN
   v_env:=OLD.id; v_type:=OLD.type;
   IF TG_OP='UPDATE' AND NEW.type='production' THEN v_type:='production'; END IF;
 ELSIF TG_TABLE_NAME='secret_versions' THEN
   SELECT s.environment_id INTO v_env FROM public.secrets s WHERE s.id=NEW.secret_id;
 ELSE
   v_env:=CASE WHEN TG_OP='DELETE' THEN OLD.environment_id ELSE NEW.environment_id END;
 END IF;
 IF v_type IS NULL THEN SELECT type INTO v_type FROM public.environments WHERE id=v_env; END IF;
 IF v_type='production' AND NOT EXISTS(SELECT 1 FROM shroud_private.production_write_permits WHERE tx=txid_current() AND environment_id=v_env AND actor_id=v_actor)
 THEN RAISE EXCEPTION 'Production writes require the checked change workflow' USING ERRCODE='P0400'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS shroud_production_guard ON public.secrets;
CREATE TRIGGER shroud_production_guard BEFORE INSERT OR UPDATE OR DELETE ON public.secrets FOR EACH ROW EXECUTE FUNCTION shroud_private.guard_production();
DROP TRIGGER IF EXISTS shroud_production_guard ON public.secret_versions;
CREATE TRIGGER shroud_production_guard BEFORE INSERT ON public.secret_versions FOR EACH ROW EXECUTE FUNCTION shroud_private.guard_production();
DROP TRIGGER IF EXISTS shroud_production_guard ON public.environments;
CREATE TRIGGER shroud_production_guard BEFORE UPDATE OR DELETE ON public.environments FOR EACH ROW EXECUTE FUNCTION shroud_private.guard_production();

CREATE OR REPLACE FUNCTION shroud_private.execute_changes(p_project uuid,p_env uuid,p_entries jsonb,p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry jsonb; secret public.secrets; n integer; changed jsonb:='[]'; action text;
BEGIN
 PERFORM set_config('shroud.actor_id',p_actor::text,true);
 FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  SELECT s.* INTO secret FROM public.secrets s WHERE s.environment_id=p_env AND s.key=entry->>'key' FOR UPDATE;
  SELECT coalesce(max(v.version),0) INTO n FROM public.secret_versions v WHERE v.secret_id=secret.id;
  IF entry ? 'expected_version' AND (entry->>'expected_version')::integer<>n THEN RAISE EXCEPTION 'The value changed since this request was created' USING ERRCODE='P0409'; END IF;
  IF entry ? 'expected_updated_at' AND (entry->>'expected_updated_at')::timestamptz IS DISTINCT FROM secret.updated_at THEN RAISE EXCEPTION 'The metadata changed since this request was created' USING ERRCODE='P0409'; END IF;
  action:=coalesce(entry->>'action','upsert');
  IF entry ? 'secret_id' AND (entry->>'secret_id')::uuid IS DISTINCT FROM secret.id THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='42501'; END IF;
  IF action='create' AND secret.id IS NOT NULL THEN RAISE EXCEPTION 'Key already exists' USING ERRCODE='23505'; END IF;
  IF action IN ('delete','metadata') AND secret.id IS NULL THEN RAISE EXCEPTION 'Secret not found' USING ERRCODE='P0404'; END IF;
  IF action='delete' THEN
   DELETE FROM public.secret_versions WHERE secret_id=secret.id;
   DELETE FROM public.secrets WHERE id=secret.id;
  ELSE
   IF secret.id IS NULL THEN
    IF NOT entry ? 'encrypted_value' THEN RAISE EXCEPTION 'Value required'; END IF;
    INSERT INTO public.secrets(environment_id,key,description,is_required,created_by)
    VALUES(p_env,entry->>'key',entry->>'description',coalesce((entry->>'is_required')::boolean,false),p_actor) RETURNING * INTO secret;
   ELSE
    UPDATE public.secrets SET description=CASE WHEN entry ? 'description' THEN entry->>'description' ELSE description END,
     is_required=CASE WHEN entry ? 'is_required' THEN (entry->>'is_required')::boolean ELSE is_required END,updated_at=now() WHERE id=secret.id RETURNING * INTO secret;
   END IF;
   IF entry ? 'encrypted_value' THEN
    n:=n+1;
    INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(secret.id,n,entry->>'encrypted_value',1,p_actor);
   END IF;
  END IF;
  changed:=changed||jsonb_build_array(jsonb_build_object('id',secret.id,'key',entry->>'key','version',n,'action',action));
 END LOOP;
 RETURN jsonb_build_object('count',jsonb_array_length(changed),'changes',changed,'pending',false);
END $$;

CREATE OR REPLACE FUNCTION public.shroud_apply_secret_changes(p_project_id uuid,p_environment_id uuid,p_entries jsonb,p_confirm_production boolean DEFAULT false,p_token_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE env public.environments; actor uuid; v_team uuid; required boolean; entry jsonb; normalized jsonb:='[]'; n integer; result jsonb; request_id uuid; v_secret_id uuid;
BEGIN
 SELECT e.* INTO env FROM public.environments e WHERE e.id=p_environment_id AND e.project_id=p_project_id FOR UPDATE;
 IF env.id IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT team_id INTO v_team FROM public.projects WHERE id=p_project_id;
 IF p_token_hash IS NOT NULL THEN
  actor:=shroud_private.assert_token(p_token_hash,v_team,'secrets:write');
  IF NOT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=v_team AND user_id=actor AND role IN ('owner','admin','developer')) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 ELSE PERFORM shroud_private.assert_project(p_project_id,true); actor:=auth.uid(); END IF;
 IF p_entries IS NULL OR jsonb_typeof(p_entries)<>'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 IF (SELECT count(DISTINCT value->>'key') FROM jsonb_array_elements(p_entries))<>jsonb_array_length(p_entries) THEN RAISE EXCEPTION 'Duplicate keys'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
  IF entry->>'key' IS NULL OR length(entry->>'key')>200 OR entry->>'key' !~ '^[A-Za-z_][A-Za-z0-9_]*$'
   OR coalesce(entry->>'action','upsert') NOT IN ('create','upsert','metadata','delete')
   OR (entry ? 'encrypted_value' AND jsonb_typeof(entry->'encrypted_value')<>'string')
   OR (entry ? 'is_required' AND jsonb_typeof(entry->'is_required')<>'boolean')
   OR (entry ? 'description' AND jsonb_typeof(entry->'description') NOT IN ('string','null'))
  THEN RAISE EXCEPTION 'Invalid batch'; END IF;
  IF entry->>'action'='delete' AND (p_token_hash IS NOT NULL OR NOT public.has_project_role(p_project_id,ARRAY['owner','admin']::public.project_role[]))
   THEN RAISE EXCEPTION 'Only project owners and admins can delete secrets' USING ERRCODE='42501'; END IF;
  SELECT s.id INTO v_secret_id FROM public.secrets s WHERE s.environment_id=env.id AND s.key=entry->>'key';
  IF entry->>'action'='create' AND v_secret_id IS NOT NULL THEN RAISE EXCEPTION 'Key already exists' USING ERRCODE='23505'; END IF;
  IF entry->>'action' IN ('metadata','delete') AND v_secret_id IS NULL THEN RAISE EXCEPTION 'Secret not found' USING ERRCODE='P0404'; END IF;
  IF v_secret_id IS NULL AND NOT entry ? 'encrypted_value' THEN RAISE EXCEPTION 'Value required'; END IF;
  IF entry ? 'secret_id' AND (entry->>'secret_id')::uuid IS DISTINCT FROM v_secret_id THEN RAISE EXCEPTION 'Resource unavailable' USING ERRCODE='42501'; END IF;
  SELECT coalesce(max(v.version),0) INTO n FROM public.secrets s JOIN public.secret_versions v ON v.secret_id=s.id WHERE s.environment_id=env.id AND s.key=entry->>'key';
  normalized:=normalized||jsonb_build_array(entry||jsonb_build_object('expected_version',n,'expected_updated_at',(SELECT updated_at FROM public.secrets WHERE id=v_secret_id)));
 END LOOP;
 IF env.type='production' AND NOT coalesce(p_confirm_production,false) THEN RAISE EXCEPTION 'Production confirmation required' USING ERRCODE='P0400'; END IF;
 SELECT require_production_approval INTO required FROM public.project_security_settings WHERE project_id=p_project_id;
 IF env.type='production' AND coalesce(required,false) THEN
  INSERT INTO shroud_private.production_change_requests(project_id,environment_id,requested_by,entries,source_token_id) VALUES(p_project_id,env.id,actor,normalized,CASE WHEN p_token_hash IS NOT NULL THEN nullif(current_setting('shroud.token_id',true),'')::uuid ELSE NULL END) RETURNING id INTO request_id;
  PERFORM shroud_private.log_event(v_team,'production.requested','environment',env.id,p_project_id,env.id,jsonb_build_object('request_id',request_id,'count',jsonb_array_length(normalized)));
  RETURN jsonb_build_object('pending',true,'request_id',request_id,'count',0);
 END IF;
 IF env.type='production' THEN INSERT INTO shroud_private.production_write_permits VALUES(txid_current(),env.id,actor); END IF;
 result:=shroud_private.execute_changes(p_project_id,env.id,normalized,actor);
 DELETE FROM shroud_private.production_write_permits WHERE tx=txid_current() AND environment_id=env.id;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.shroud_set_production_policy(p_project_id uuid,p_require_approval boolean,p_confirm boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid:=shroud_private.assert_project(p_project_id,false,true);
BEGIN
 IF NOT coalesce(p_confirm,false) THEN RAISE EXCEPTION 'Confirmation required' USING ERRCODE='P0400'; END IF;
 INSERT INTO public.project_security_settings(project_id,require_production_approval,updated_by) VALUES(p_project_id,p_require_approval,auth.uid())
 ON CONFLICT(project_id) DO UPDATE SET require_production_approval=excluded.require_production_approval,updated_by=auth.uid(),updated_at=now();
 PERFORM shroud_private.log_event(v_team,'production.policy_changed','project',p_project_id,p_project_id,NULL,jsonb_build_object('approval_required',p_require_approval));
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_list_change_requests(p_project_id uuid)
RETURNS TABLE(id uuid,requested_by uuid,requester_name text,status text,created_at timestamptz,expires_at timestamptz,environment_id uuid,changes jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM shroud_private.assert_project(p_project_id);
 RETURN QUERY SELECT r.id,r.requested_by,p.full_name,r.status,r.created_at,r.expires_at,r.environment_id,
 (SELECT jsonb_agg(jsonb_build_object('key',entry->>'key','action',coalesce(entry->>'action','upsert'))) FROM jsonb_array_elements(r.entries) entry)
 FROM shroud_private.production_change_requests r LEFT JOIN public.profiles p ON p.id=r.requested_by WHERE r.project_id=p_project_id ORDER BY r.created_at DESC LIMIT 100;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_review_change_request(p_request_id uuid,p_approve boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r shroud_private.production_change_requests; v_team uuid; result jsonb;
BEGIN
 SELECT * INTO r FROM shroud_private.production_change_requests WHERE id=p_request_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='42501'; END IF;
 v_team:=shroud_private.assert_project(r.project_id,false,p_approve OR r.requested_by IS DISTINCT FROM auth.uid());
 IF r.status<>'pending' OR r.expires_at<=now() THEN RAISE EXCEPTION 'Request no longer available' USING ERRCODE='P0409'; END IF;
 IF p_approve THEN
  IF r.requested_by=auth.uid() THEN RAISE EXCEPTION 'A different project owner or admin must approve' USING ERRCODE='42501'; END IF;
  IF r.source_token_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.api_tokens t JOIN public.team_members tm ON tm.team_id=t.team_id AND tm.user_id=t.created_by
    WHERE t.id=r.source_token_id AND t.team_id=v_team AND t.created_by=r.requested_by AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at>now()) AND t.scopes ? 'secrets:write' AND tm.role IN ('owner','admin','developer'))
   THEN RAISE EXCEPTION 'The requesting token no longer has write access' USING ERRCODE='42501'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM public.project_members pm JOIN public.team_members tm ON tm.user_id=pm.user_id AND tm.team_id=v_team WHERE pm.project_id=r.project_id AND pm.user_id=r.requested_by AND pm.role IN ('owner','admin','developer'))
  THEN RAISE EXCEPTION 'The requester no longer has write access' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.environments WHERE id=r.environment_id FOR UPDATE;
  INSERT INTO shroud_private.production_write_permits VALUES(txid_current(),r.environment_id,auth.uid());
  result:=shroud_private.execute_changes(r.project_id,r.environment_id,r.entries,auth.uid());
  DELETE FROM shroud_private.production_write_permits WHERE tx=txid_current() AND environment_id=r.environment_id;
  UPDATE shroud_private.production_change_requests SET status='applied',reviewed_by=auth.uid(),reviewed_at=now() WHERE id=r.id;
 ELSE
  UPDATE shroud_private.production_change_requests SET status=CASE WHEN requested_by=auth.uid() THEN 'cancelled' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now() WHERE id=r.id;
  result:=jsonb_build_object('pending',false,'count',0);
 END IF;
 PERFORM shroud_private.log_event(v_team,CASE WHEN p_approve THEN 'production.approved' ELSE 'production.rejected' END,'environment',r.environment_id,r.project_id,r.environment_id,jsonb_build_object('request_id',r.id));
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_delete_project_confirmed(p_project_id uuid,p_confirm_production boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE env record; actor uuid:=auth.uid(); result boolean;
BEGIN
 PERFORM shroud_private.assert_project(p_project_id,false,true);
 PERFORM 1 FROM public.projects WHERE id=p_project_id FOR UPDATE;
 FOR env IN SELECT id FROM public.environments WHERE project_id=p_project_id AND type='production' FOR UPDATE LOOP
  IF NOT coalesce(p_confirm_production,false) THEN RAISE EXCEPTION 'Production confirmation required' USING ERRCODE='P0400'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_security_settings WHERE project_id=p_project_id AND require_production_approval) THEN RAISE EXCEPTION 'Disable the production approval policy before deleting the project' USING ERRCODE='P0400'; END IF;
  INSERT INTO shroud_private.production_write_permits VALUES(txid_current(),env.id,actor);
 END LOOP;
 result:=public.shroud_delete_project(p_project_id);
 DELETE FROM shroud_private.production_write_permits WHERE tx=txid_current() AND actor_id=actor;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.shroud_set_rotation(p_secret_id uuid,p_next_rotation_at timestamptz,p_interval_days integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_project uuid; v_team uuid;
BEGIN
 SELECT e.project_id INTO v_project FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id WHERE s.id=p_secret_id;
 v_team:=shroud_private.assert_project(v_project,true);
 IF p_interval_days IS NOT NULL AND p_interval_days NOT BETWEEN 1 AND 3650 THEN RAISE EXCEPTION 'Invalid interval'; END IF;
 IF p_next_rotation_at IS NULL THEN DELETE FROM public.secret_rotation_schedules WHERE secret_id=p_secret_id;
 ELSE INSERT INTO public.secret_rotation_schedules(secret_id,next_rotation_at,interval_days,updated_by) VALUES(p_secret_id,p_next_rotation_at,p_interval_days,auth.uid())
 ON CONFLICT(secret_id) DO UPDATE SET next_rotation_at=excluded.next_rotation_at,interval_days=excluded.interval_days,updated_by=auth.uid(),updated_at=now(); END IF;
 PERFORM shroud_private.log_event(v_team,'secret.rotation_scheduled','secret',p_secret_id,v_project);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION shroud_private.refresh_rotation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.secret_rotation_schedules SET last_rotated_at=now(),next_rotation_at=CASE WHEN interval_days IS NULL THEN NULL ELSE now()+make_interval(days=>interval_days) END,updated_at=now() WHERE secret_id=NEW.secret_id;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS shroud_rotation_updated ON public.secret_versions;
CREATE TRIGGER shroud_rotation_updated AFTER INSERT ON public.secret_versions FOR EACH ROW EXECUTE FUNCTION shroud_private.refresh_rotation();
CREATE OR REPLACE FUNCTION public.shroud_rotation_reminders(p_team_id uuid)
RETURNS TABLE(secret_id uuid,key text,project_id uuid,project_name text,environment_id uuid,environment_name text,next_rotation_at timestamptz,interval_days integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.is_team_member(p_team_id) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT s.id,s.key,p.id,p.name,e.id,e.name,r.next_rotation_at,r.interval_days FROM public.secret_rotation_schedules r JOIN public.secrets s ON s.id=r.secret_id JOIN public.environments e ON e.id=s.environment_id JOIN public.projects p ON p.id=e.project_id JOIN public.project_members pm ON pm.project_id=p.id AND pm.user_id=auth.uid() WHERE p.team_id=p_team_id AND r.next_rotation_at IS NOT NULL ORDER BY r.next_rotation_at;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_project_ciphertexts(p_project_id uuid)
RETURNS TABLE(secret_id uuid,key text,environment_id uuid,encrypted_value text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM shroud_private.assert_project(p_project_id);
 PERFORM shroud_private.log_event(shroud_private.assert_project(p_project_id),'secrets.compared','project',p_project_id,p_project_id);
 RETURN QUERY SELECT s.id,s.key,s.environment_id,v.encrypted_value FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id JOIN LATERAL(SELECT sv.encrypted_value FROM public.secret_versions sv WHERE sv.secret_id=s.id ORDER BY sv.version DESC LIMIT 1)v ON true WHERE e.project_id=p_project_id ORDER BY s.key,CASE e.type WHEN 'development' THEN 0 WHEN 'staging' THEN 1 ELSE 2 END;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shroud_private FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.shroud_change_request_ciphertexts(p_project_id uuid,p_request_id uuid)
RETURNS TABLE(key text,proposed_value text,current_value text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM shroud_private.assert_project(p_project_id,false,true);
 RETURN QUERY SELECT entry->>'key',entry->>'encrypted_value',v.encrypted_value
 FROM shroud_private.production_change_requests r CROSS JOIN LATERAL jsonb_array_elements(r.entries) entry
 LEFT JOIN public.secrets s ON s.environment_id=r.environment_id AND s.key=entry->>'key'
 LEFT JOIN LATERAL(SELECT sv.encrypted_value FROM public.secret_versions sv WHERE sv.secret_id=s.id ORDER BY sv.version DESC LIMIT 1) v ON true
 WHERE r.project_id=p_project_id AND r.id=p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.shroud_change_request_ciphertexts(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_change_request_ciphertexts(uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.shroud_apply_secret_changes(uuid,uuid,jsonb,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shroud_apply_secret_changes(uuid,uuid,jsonb,boolean,text) TO anon,authenticated;
REVOKE ALL ON FUNCTION public.shroud_set_production_policy(uuid,boolean,boolean),public.shroud_list_change_requests(uuid),public.shroud_review_change_request(uuid,boolean),public.shroud_delete_project_confirmed(uuid,boolean),public.shroud_set_rotation(uuid,timestamptz,integer),public.shroud_rotation_reminders(uuid),public.shroud_project_ciphertexts(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_set_production_policy(uuid,boolean,boolean),public.shroud_list_change_requests(uuid),public.shroud_review_change_request(uuid,boolean),public.shroud_delete_project_confirmed(uuid,boolean),public.shroud_set_rotation(uuid,timestamptz,integer),public.shroud_rotation_reminders(uuid),public.shroud_project_ciphertexts(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
