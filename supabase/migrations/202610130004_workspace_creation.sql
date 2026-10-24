BEGIN;
CREATE OR REPLACE FUNCTION public.create_team(team_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE new_team uuid; actor uuid := auth.uid(); slug text;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF team_name IS NULL OR length(trim(team_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid workspace name'; END IF;
  slug := coalesce(nullif(trim(both '-' from lower(regexp_replace(trim(team_name),'[^a-zA-Z0-9]+','-','g'))),''),'team') || '-' || substr(gen_random_uuid()::text,1,8);
  INSERT INTO public.teams(name,slug,owner_id) VALUES(trim(team_name),slug,actor) RETURNING id INTO new_team;
  INSERT INTO public.team_members(team_id,user_id,role) VALUES(new_team,actor,'owner');
  RETURN json_build_object('team_id',new_team,'project_id',NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.create_team(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_team(text) TO authenticated;
INSERT INTO public.project_members(project_id,user_id,role)
SELECT p.id,p.created_by,'owner'::public.project_role FROM public.projects p
JOIN public.teams t ON t.id=p.team_id AND t.owner_id=p.created_by
JOIN public.team_members tm ON tm.team_id=t.id AND tm.user_id=p.created_by AND tm.role='owner'
WHERE p.name='My First Project' AND p.created_by IS NOT NULL
AND NOT EXISTS(SELECT 1 FROM public.project_members pm WHERE pm.project_id=p.id AND pm.user_id=p.created_by);
NOTIFY pgrst,'reload schema';
COMMIT;
