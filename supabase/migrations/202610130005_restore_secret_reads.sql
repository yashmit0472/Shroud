-- Focused repair for installations missing the authenticated browser read RPC.
-- Does not change secret values, encryption keys, or table policies.
BEGIN;

CREATE OR REPLACE FUNCTION public.shroud_browser_pull(
  p_project_id uuid,
  p_environment_id uuid
)
RETURNS TABLE(key text, encrypted_value text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  selected_team_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT p.team_id INTO selected_team_id
  FROM public.projects AS p
  JOIN public.environments AS e ON e.project_id = p.id
  JOIN public.project_members AS pm
    ON pm.project_id = p.id AND pm.user_id = caller_id
  JOIN public.team_members AS tm
    ON tm.team_id = p.team_id AND tm.user_id = caller_id
  WHERE p.id = p_project_id AND e.id = p_environment_id;

  IF selected_team_id IS NULL THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.audit_logs(
    team_id, actor_id, action, resource_type, resource_id,
    project_id, environment_id
  ) VALUES (
    selected_team_id, caller_id, 'secrets.pull', 'environment',
    p_environment_id, p_project_id, p_environment_id
  );

  RETURN QUERY
  SELECT s.key, latest.encrypted_value
  FROM public.secrets AS s
  JOIN LATERAL (
    SELECT sv.encrypted_value
    FROM public.secret_versions AS sv
    WHERE sv.secret_id = s.id
    ORDER BY sv.version DESC
    LIMIT 1
  ) AS latest ON true
  WHERE s.environment_id = p_environment_id
  ORDER BY s.key;
END;
$function$;

REVOKE ALL ON FUNCTION public.shroud_browser_pull(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shroud_browser_pull(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
