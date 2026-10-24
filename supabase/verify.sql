-- Read-only installation check. No values or credentials are selected.
SELECT name, to_regprocedure(name) IS NOT NULL AS installed
FROM unnest(ARRAY[
 'public.create_team(text)',
 'public.shroud_create_project(uuid,text,text)',
 'public.shroud_secret_history(uuid,uuid,uuid)',
 'public.shroud_browser_pull(uuid,uuid)',
 'public.shroud_browser_push(uuid,uuid,jsonb)',
 'public.shroud_apply_secret_changes(uuid,uuid,jsonb,boolean,text)',
 'public.shroud_list_change_requests(uuid)',
 'public.shroud_set_rotation(uuid,timestamp with time zone,integer)',
 'public.shroud_project_ciphertexts(uuid)',
 'public.shroud_review_change_request(uuid,boolean)',
 'public.shroud_vercel_metadata(uuid)',
 'public.shroud_setup_status(uuid)'
]) name;
SELECT c.relname AS table_name,c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
