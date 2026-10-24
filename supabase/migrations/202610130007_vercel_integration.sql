BEGIN;
CREATE OR REPLACE FUNCTION public.shroud_vercel_metadata(p_project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE connection shroud_private.vercel_connections;
BEGIN
 PERFORM shroud_private.assert_project(p_project_id,false,true);
 SELECT * INTO connection FROM shroud_private.vercel_connections WHERE project_id=p_project_id;
 RETURN jsonb_build_object('connected',connection.project_id IS NOT NULL,'vercel_project_id',connection.vercel_project_id,'vercel_team_id',connection.vercel_team_id,'last_synced_at',connection.last_synced_at);
END $$;
CREATE OR REPLACE FUNCTION public.shroud_set_vercel_connection(p_project_id uuid,p_vercel_project_id text,p_vercel_team_id text,p_encrypted_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid:=shroud_private.assert_project(p_project_id,false,true);
BEGIN
 IF p_vercel_project_id !~ '^[a-zA-Z0-9_-]{1,100}$' OR p_encrypted_token IS NULL OR length(p_encrypted_token)<40 THEN RAISE EXCEPTION 'Invalid connection'; END IF;
 INSERT INTO shroud_private.vercel_connections(project_id,vercel_project_id,vercel_team_id,encrypted_token,updated_by)
 VALUES(p_project_id,p_vercel_project_id,p_vercel_team_id,p_encrypted_token,auth.uid())
 ON CONFLICT(project_id) DO UPDATE SET vercel_project_id=excluded.vercel_project_id,vercel_team_id=excluded.vercel_team_id,encrypted_token=excluded.encrypted_token,updated_by=auth.uid(),updated_at=now(),last_synced_at=NULL,last_environment_id=NULL;
 PERFORM shroud_private.log_event(v_team,'vercel.connected','project',p_project_id,p_project_id);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_vercel_credentials(p_project_id uuid)
RETURNS TABLE(vercel_project_id text,vercel_team_id text,encrypted_token text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM shroud_private.assert_project(p_project_id,false,true);
 RETURN QUERY SELECT c.vercel_project_id,c.vercel_team_id,c.encrypted_token FROM shroud_private.vercel_connections c WHERE c.project_id=p_project_id;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_disconnect_vercel(p_project_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid:=shroud_private.assert_project(p_project_id,false,true);
BEGIN
 DELETE FROM shroud_private.vercel_connections WHERE project_id=p_project_id;
 PERFORM shroud_private.log_event(v_team,'vercel.disconnected','project',p_project_id,p_project_id);
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.shroud_record_vercel_sync(p_project_id uuid,p_environment_id uuid,p_target text,p_count integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_team uuid:=shroud_private.assert_project(p_project_id,false,true);
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.environments WHERE id=p_environment_id AND project_id=p_project_id) OR p_target NOT IN ('development','preview','production') OR p_count<0 THEN RAISE EXCEPTION 'Invalid sync'; END IF;
 UPDATE shroud_private.vercel_connections SET last_synced_at=now(),last_environment_id=p_environment_id WHERE project_id=p_project_id;
 PERFORM shroud_private.log_event(v_team,'vercel.synced','environment',p_environment_id,p_project_id,p_environment_id,jsonb_build_object('target',p_target,'count',p_count));
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.shroud_vercel_metadata(uuid),public.shroud_set_vercel_connection(uuid,text,text,text),public.shroud_vercel_credentials(uuid),public.shroud_disconnect_vercel(uuid),public.shroud_record_vercel_sync(uuid,uuid,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_vercel_metadata(uuid),public.shroud_set_vercel_connection(uuid,text,text,text),public.shroud_vercel_credentials(uuid),public.shroud_disconnect_vercel(uuid),public.shroud_record_vercel_sync(uuid,uuid,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
CREATE OR REPLACE FUNCTION public.shroud_setup_status(p_team_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE missing jsonb;
BEGIN
 IF NOT public.has_team_role(p_team_id,ARRAY['owner','admin']::public.team_role[]) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(name),'[]') INTO missing FROM unnest(ARRAY[
  'public.create_team(text)','public.shroud_create_project(uuid,text,text)',
  'public.shroud_browser_pull(uuid,uuid)','public.shroud_apply_secret_changes(uuid,uuid,jsonb,boolean,text)',
  'public.shroud_review_change_request(uuid,boolean)','public.shroud_set_rotation(uuid,timestamp with time zone,integer)',
  'public.shroud_project_ciphertexts(uuid)','public.shroud_vercel_metadata(uuid)'
 ]) name WHERE to_regprocedure(name) IS NULL;
 RETURN jsonb_build_object('ready',jsonb_array_length(missing)=0,'missing',missing);
END $$;
REVOKE ALL ON FUNCTION public.shroud_setup_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_setup_status(uuid) TO authenticated;
COMMIT;
