BEGIN;
CREATE OR REPLACE FUNCTION public.shroud_browser_pull(p_project_id uuid,p_environment_id uuid)
RETURNS TABLE(key text,encrypted_value text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_team uuid;
BEGIN
  SELECT p.team_id INTO v_team FROM public.projects p JOIN public.environments e ON e.project_id=p.id
  JOIN public.project_members pm ON pm.project_id=p.id AND pm.user_id=auth.uid()
  JOIN public.team_members tm ON tm.team_id=p.team_id AND tm.user_id=auth.uid()
  WHERE p.id=p_project_id AND e.id=p_environment_id;
  IF v_team IS NULL THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  PERFORM shroud_private.log_event(v_team,'secrets.pull','environment',p_environment_id,p_project_id,p_environment_id);
  RETURN QUERY SELECT s.key,v.encrypted_value FROM public.secrets s JOIN LATERAL
    (SELECT sv.encrypted_value FROM public.secret_versions sv WHERE sv.secret_id=s.id ORDER BY sv.version DESC LIMIT 1) v ON true
    WHERE s.environment_id=p_environment_id ORDER BY s.key;
END;
$function$;
CREATE OR REPLACE FUNCTION public.shroud_browser_push(p_project_id uuid,p_environment_id uuid,p_secrets jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE entry jsonb; v_secret public.secrets; count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.environments e
    JOIN public.project_members pm ON pm.project_id=e.project_id AND pm.user_id=auth.uid() AND pm.role IN ('owner','admin','developer')
    JOIN public.projects p ON p.id=e.project_id
    JOIN public.team_members tm ON tm.team_id=p.team_id AND tm.user_id=auth.uid()
    WHERE e.id=p_environment_id AND e.project_id=p_project_id)
  THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_secrets) <> 'array' OR jsonb_array_length(p_secrets) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_secrets) LOOP
    IF entry->>'key' IS NULL OR entry->>'key' !~ '^[A-Za-z_][A-Za-z0-9_]*$' OR jsonb_typeof(entry->'encrypted_value') <> 'string'
    THEN RAISE EXCEPTION 'Invalid batch'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_environment_id::text || ':' || (entry->>'key'),0));
    SELECT s.* INTO v_secret FROM public.secrets s WHERE s.environment_id=p_environment_id AND s.key=entry->>'key' FOR UPDATE;
    IF v_secret.id IS NULL THEN
      v_secret := public.create_secret_with_version(p_environment_id,entry->>'key',NULL,false,entry->>'encrypted_value',1,auth.uid());
    ELSE
      PERFORM public.create_secret_version(v_secret.id,entry->>'encrypted_value',1,auth.uid());
      UPDATE public.secrets SET updated_at=now() WHERE id=v_secret.id;
    END IF;
    count := count+1;
  END LOOP;
  RETURN count;
END;
$function$;
REVOKE ALL ON FUNCTION public.shroud_browser_pull(uuid,uuid),public.shroud_browser_push(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_browser_pull(uuid,uuid),public.shroud_browser_push(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
