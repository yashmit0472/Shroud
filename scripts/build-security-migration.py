"""Generate reviewed SQL wrappers around the user's exported legacy RPCs."""
from pathlib import Path
import re

out = ["-- Core authorization upgrade. Prefer the generated supabase/install.sql installer.\nBEGIN;\nCREATE SCHEMA IF NOT EXISTS shroud_private;\nREVOKE ALL ON SCHEMA shroud_private FROM PUBLIC, anon, authenticated;\n"]
out.append("""
CREATE TABLE shroud_private.token_rate_limits(token_id uuid PRIMARY KEY REFERENCES public.api_tokens(id) ON DELETE CASCADE, window_start timestamptz NOT NULL, requests integer NOT NULL);
CREATE FUNCTION shroud_private.assert_token(p_hash text, p_team uuid, p_scope text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE token public.api_tokens; request_count integer;
BEGIN
  SELECT t.* INTO token FROM public.api_tokens t
  WHERE t.token_hash = p_hash AND t.team_id = p_team AND t.revoked_at IS NULL
    AND (t.expires_at IS NULL OR t.expires_at > now()) AND t.scopes ? p_scope;
  IF token.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.team_members m WHERE m.team_id = p_team AND m.user_id = token.created_by) THEN
    RAISE EXCEPTION 'Invalid token or insufficient scope' USING ERRCODE = '42501';
  END IF;
  INSERT INTO shroud_private.token_rate_limits(token_id,window_start,requests) VALUES(token.id,date_trunc('minute',now()),1)
  ON CONFLICT(token_id) DO UPDATE SET window_start=excluded.window_start,
    requests=CASE WHEN shroud_private.token_rate_limits.window_start=excluded.window_start THEN shroud_private.token_rate_limits.requests+1 ELSE 1 END
  RETURNING requests INTO request_count;
  IF request_count>120 THEN RAISE EXCEPTION 'Token rate limit exceeded' USING ERRCODE='P0429'; END IF;
  PERFORM set_config('shroud.token_id', token.id::text, true);
  PERFORM set_config('shroud.actor_id', token.created_by::text, true);
  RETURN token.created_by;
END; $$;

CREATE FUNCTION shroud_private.log_event(p_team uuid, p_action text, p_resource_type text, p_resource uuid DEFAULT NULL, p_project uuid DEFAULT NULL, p_environment uuid DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs(team_id, actor_id, token_id, action, resource_type, resource_id, project_id, environment_id, metadata)
  VALUES(p_team, coalesce(nullif(current_setting('shroud.actor_id', true), '')::uuid, auth.uid()),
    nullif(current_setting('shroud.token_id', true), '')::uuid, p_action, p_resource_type, p_resource, p_project, p_environment, p_metadata);
END; $$;
""")

token_functions = [
    ("list_projects_for_api_token", "p_team_id uuid", "TABLE(id uuid, name text, slug text, description text, created_at timestamptz, updated_at timestamptz)", "secrets:read", None),
    ("list_environments_for_api_token", "p_team_id uuid, p_project_id uuid", "TABLE(id uuid, project_id uuid, name text, slug text, type public.environment_type, created_at timestamptz)", "secrets:read", None),
    ("list_secrets_for_api_token", "p_team_id uuid, p_project_id uuid, p_environment_id uuid", "TABLE(id uuid, key text, description text, is_required boolean)", "secrets:read", None),
    ("get_secret_value_for_api_token", "p_team_id uuid, p_project_id uuid, p_environment_id uuid, p_secret_id uuid", "TABLE(id uuid, key text, encrypted_value text, encryption_version integer)", "secrets:read", "secret.read"),
    ("get_all_secret_values_for_api_token", "p_team_id uuid, p_project_id uuid, p_environment_id uuid", "TABLE(id uuid, key text, encrypted_value text, encryption_version integer)", "secrets:read", "secrets.pull"),
    ("get_team_for_api_token", "p_team_id uuid", "TABLE(id uuid, name text, slug text, owner_id uuid, created_at timestamptz, updated_at timestamptz)", "secrets:read", None),
    ("create_secret_for_api_token", "p_team_id uuid, p_project_id uuid, p_environment_id uuid, p_key text, p_description text, p_is_required boolean, p_encrypted_value text, p_encryption_version integer, p_created_by uuid", "TABLE(id uuid, key text, description text, is_required boolean, version integer)", "secrets:write", None),
]
for name, args, returns, scope, event in token_functions:
    parts = [part.strip() for part in args.split(",")]
    types = ", ".join(part.split(" ", 1)[1] for part in parts)
    values = ", ".join(part.split(" ", 1)[0] for part in parts)
    extras = ""
    if scope == "secrets:write":
        extras = """
  IF p_created_by IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Invalid actor' USING ERRCODE = '42501'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN RAISE EXCEPTION 'Invalid key'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members m WHERE m.team_id = p_team_id AND m.user_id = actor AND m.role IN ('owner','admin','developer')) THEN
    RAISE EXCEPTION 'Insufficient write access' USING ERRCODE = '42501';
  END IF;
  -- Serialize concurrent pushes for the same environment/key, including first creation.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_environment_id::text || ':' || p_key, 0));
  PERFORM 1 FROM public.secrets s WHERE s.environment_id = p_environment_id AND s.key = p_key FOR UPDATE;
"""
    if event:
        extras += f"\n  IF NOT EXISTS(SELECT 1 FROM public.environments e JOIN public.projects p ON p.id=e.project_id WHERE e.id=p_environment_id AND p.id=p_project_id AND p.team_id=p_team_id) THEN RAISE EXCEPTION 'Environment not found' USING ERRCODE='42501'; END IF;\n  PERFORM shroud_private.log_event(p_team_id, '{event}', 'secret', {'p_secret_id' if 'p_secret_id' in values else 'NULL'}, p_project_id, p_environment_id);\n"
    out.append(f"""
ALTER FUNCTION public.{name}({types}) SET SCHEMA shroud_private;
REVOKE ALL ON FUNCTION shroud_private.{name}({types}) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.{name}({args}, p_token_hash text DEFAULT NULL)
RETURNS {returns} LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid;
BEGIN
  actor := shroud_private.assert_token(p_token_hash, p_team_id, '{scope}');
{extras}
  RETURN QUERY SELECT * FROM shroud_private.{name}({values});
END; $$;
REVOKE ALL ON FUNCTION public.{name}({types}, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.{name}({types}, text) TO anon, authenticated;
""")

session_functions = [
    ("create_secret_with_version", "p_environment_id uuid, p_key text, p_description text, p_is_required boolean, p_encrypted_value text, p_encryption_version integer, p_created_by uuid", "public.secrets", "p_created_by", """
  IF NOT EXISTS (SELECT 1 FROM public.environments e JOIN public.project_members m ON m.project_id=e.project_id
    WHERE e.id=p_environment_id AND m.user_id=auth.uid() AND m.role IN ('owner','admin','developer')) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR p_key !~ '^[A-Za-z_][A-Za-z0-9_]*$' THEN RAISE EXCEPTION 'Invalid key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_environment_id::text || ':' || p_key, 0));
  IF EXISTS (SELECT 1 FROM public.secrets s WHERE s.environment_id=p_environment_id AND s.key=p_key) THEN
    RAISE EXCEPTION 'Key already exists' USING ERRCODE='23505'; END IF;
"""),
    ("create_secret_version", "p_secret_id uuid, p_encrypted_value text, p_encryption_version integer, p_created_by uuid", "public.secret_versions", "p_created_by", """
  IF NOT EXISTS (SELECT 1 FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id
    JOIN public.project_members m ON m.project_id=e.project_id
    WHERE s.id=p_secret_id AND m.user_id=auth.uid() AND m.role IN ('owner','admin','developer')) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM public.secrets s WHERE s.id=p_secret_id FOR UPDATE;
"""),
    ("create_team_invitation", "p_team_id uuid, p_invited_by uuid, p_role public.team_role, p_expires_at timestamptz", "TABLE(id uuid, team_id uuid, role public.team_role, token text, invite_code text, expires_at timestamptz)", "p_invited_by", """
  IF p_role NOT IN ('admin','developer','viewer') OR p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'Invalid invitation role or expiration'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members m WHERE m.team_id=p_team_id AND m.user_id=auth.uid()
    AND (m.role='owner' OR (m.role='admin' AND p_role IN ('developer','viewer')))) THEN
    RAISE EXCEPTION 'Insufficient team access' USING ERRCODE='42501'; END IF;
  PERFORM shroud_private.log_event(p_team_id, 'team.invitation_created', 'team', p_team_id);
"""),
    ("list_team_members", "p_team_id uuid, p_user_id uuid", "TABLE(id uuid, user_id uuid, full_name text, avatar_url text, role public.team_role, created_at timestamptz)", "p_user_id", ""),
    ("list_team_invitations", "p_team_id uuid, p_user_id uuid", "TABLE(id uuid, role public.team_role, expires_at timestamptz, created_at timestamptz, invited_by uuid)", "p_user_id", ""),
    ("remove_team_member", "p_team_id uuid, p_target_user_id uuid, p_requester_id uuid", "boolean", "p_requester_id", """
  -- Lock the team to serialize role changes and member removal.
  PERFORM 1 FROM public.teams t WHERE t.id=p_team_id FOR UPDATE;
"""),
]
for name, args, returns, actor, extras in session_functions:
    parts = [part.strip() for part in args.split(",")]
    types = ", ".join(part.split(" ", 1)[1] for part in parts)
    values = ", ".join(part.split(" ", 1)[0] for part in parts)
    is_table = returns.startswith("TABLE")
    result = f"RETURN QUERY SELECT * FROM shroud_private.{name}({values});" if is_table else f"result := shroud_private.{name}({values});"
    tail = ""
    if name == "remove_team_member":
        tail = """
  DELETE FROM public.project_members m USING public.projects p WHERE m.project_id=p.id AND p.team_id=p_team_id AND m.user_id=p_target_user_id;
  UPDATE public.api_tokens SET revoked_at=now() WHERE team_id=p_team_id AND created_by=p_target_user_id AND revoked_at IS NULL;
"""
    if not is_table:
        tail += "\n  RETURN result;"
    out.append(f"""
ALTER FUNCTION public.{name}({types}) SET SCHEMA shroud_private;
REVOKE ALL ON FUNCTION shroud_private.{name}({types}) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.{name}({args}) RETURNS {returns}
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
{'DECLARE result ' + returns + ';' if not is_table else ''}
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM {actor} THEN
    RAISE EXCEPTION 'Invalid actor' USING ERRCODE='42501'; END IF;
{extras}
  {result}
{tail}
END; $$;
REVOKE ALL ON FUNCTION public.{name}({types}) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.{name}({types}) TO authenticated;
""")

out.append("""
-- The old self-join policies allow callers to choose their own privileged role.
-- Membership changes now go through checked database functions.
DROP POLICY IF EXISTS team_members_insert_self ON public.team_members;
DROP POLICY IF EXISTS project_members_insert_self ON public.project_members;
DROP POLICY IF EXISTS team_members_update_admin ON public.team_members;
DROP POLICY IF EXISTS team_members_delete_admin ON public.team_members;
DROP POLICY IF EXISTS project_members_update_admin ON public.project_members;
DROP POLICY IF EXISTS project_members_delete_admin ON public.project_members;

CREATE FUNCTION public.shroud_revoke_api_token(p_token_id uuid, p_team_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_team_role(p_team_id, ARRAY['owner','admin']::public.team_role[]) THEN
    RAISE EXCEPTION 'Insufficient team access' USING ERRCODE='42501'; END IF;
  UPDATE public.api_tokens SET revoked_at=coalesce(revoked_at, now()) WHERE id=p_token_id AND team_id=p_team_id;
  RETURN FOUND;
END; $$;

CREATE FUNCTION public.shroud_create_project(p_team_id uuid, p_name text, p_description text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_team_role(p_team_id, ARRAY['owner','admin','developer']::public.team_role[]) THEN
    RAISE EXCEPTION 'Insufficient team access' USING ERRCODE='42501'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid project name'; END IF;
  INSERT INTO public.projects(team_id,name,slug,description,created_by)
  VALUES(p_team_id,trim(p_name),coalesce(nullif(trim(both '-' from lower(regexp_replace(p_name,'[^a-zA-Z0-9]+','-','g'))),''),'project') || '-' || substr(gen_random_uuid()::text,1,8),p_description,auth.uid())
  RETURNING id INTO project_id;
  INSERT INTO public.project_members(project_id,user_id,role) VALUES(project_id,auth.uid(),'owner');
  INSERT INTO public.environments(project_id,name,slug,type) VALUES
    (project_id,'Development','development','development'), (project_id,'Staging','staging','staging'), (project_id,'Production','production','production');
  INSERT INTO public.project_members(project_id,user_id,role)
  SELECT project_id,m.user_id,'admin'::public.project_role FROM public.team_members m WHERE m.team_id=p_team_id AND m.user_id<>auth.uid() AND m.role IN ('owner','admin');
  RETURN project_id;
END; $$;

CREATE FUNCTION public.shroud_secret_history(p_project_id uuid, p_environment_id uuid, p_secret_id uuid)
RETURNS TABLE(id uuid,version integer,created_by uuid,created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_project_member(p_project_id) OR NOT EXISTS(SELECT 1 FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id WHERE s.id=p_secret_id AND e.id=p_environment_id AND e.project_id=p_project_id) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT v.id,v.version,v.created_by,v.created_at FROM public.secret_versions v WHERE v.secret_id=p_secret_id ORDER BY v.version DESC;
END; $$;

-- Trigger-based auditing avoids relying on browser code and never stores values.
CREATE FUNCTION shroud_private.audit_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE record_data jsonb; v_team uuid; v_project uuid; v_environment uuid; v_resource uuid; v_metadata jsonb := '{}'::jsonb;
BEGIN
  record_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_resource := (record_data->>'id')::uuid;
  IF TG_TABLE_NAME IN ('secrets','secret_versions') THEN
    IF TG_TABLE_NAME='secrets' THEN
      v_environment := (record_data->>'environment_id')::uuid;
      v_metadata := jsonb_build_object('key',record_data->>'key');
    ELSE
      SELECT s.environment_id INTO v_environment FROM public.secrets s WHERE s.id=(record_data->>'secret_id')::uuid;
      v_metadata := jsonb_build_object('version',(record_data->>'version')::integer);
    END IF;
    SELECT e.project_id,p.team_id INTO v_project,v_team FROM public.environments e JOIN public.projects p ON p.id=e.project_id WHERE e.id=v_environment;
  ELSIF TG_TABLE_NAME IN ('project_members','required_keys','environments') THEN
    v_project := (record_data->>'project_id')::uuid;
    SELECT p.team_id INTO v_team FROM public.projects p WHERE p.id=v_project;
  ELSE
    v_team := (record_data->>'team_id')::uuid;
    IF TG_TABLE_NAME='projects' AND TG_OP<>'DELETE' THEN v_project := v_resource; END IF;
  END IF;
  IF TG_TABLE_NAME='api_tokens' THEN
    IF TG_OP='UPDATE' THEN
      IF OLD.revoked_at IS NOT DISTINCT FROM NEW.revoked_at THEN RETURN NEW; END IF;
    END IF;
  END IF;
  IF v_team IS NOT NULL THEN
    PERFORM shroud_private.log_event(v_team,TG_TABLE_NAME || '.' || lower(TG_OP),TG_TABLE_NAME,v_resource,v_project,v_environment,v_metadata);
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;

DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['projects','secrets','secret_versions','team_members','project_members','required_keys','api_tokens','environments'] LOOP
    EXECUTE format('CREATE TRIGGER shroud_audit_mutation AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION shroud_private.audit_mutation()',table_name);
  END LOOP;
END; $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shroud_private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shroud_revoke_api_token(uuid,uuid), public.shroud_create_project(uuid,text,text), public.shroud_secret_history(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shroud_revoke_api_token(uuid,uuid), public.shroud_create_project(uuid,text,text), public.shroud_secret_history(uuid,uuid,uuid) TO authenticated;
""")

# Invitation acceptance must derive its actor and preserve an existing member's role.
out.append("""
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_token text, p_user_id uuid)
RETURNS TABLE(team_id uuid, role public.team_role) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.team_invitations; member_role public.team_role;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Invalid actor' USING ERRCODE='42501'; END IF;
  SELECT i.* INTO invitation FROM public.team_invitations i WHERE i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND i.accepted_at IS NULL AND i.expires_at>now() FOR UPDATE;
  IF invitation.id IS NULL THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
  IF invitation.email IS NOT NULL AND lower(invitation.email) IS DISTINCT FROM lower(auth.jwt()->>'email') THEN
    RAISE EXCEPTION 'Invitation belongs to a different email address' USING ERRCODE='42501'; END IF;
  IF invitation.role='owner' THEN RAISE EXCEPTION 'Owner invitations are not allowed'; END IF;
  PERFORM 1 FROM public.teams t WHERE t.id=invitation.team_id FOR UPDATE;
  SELECT m.role INTO member_role FROM public.team_members m WHERE m.team_id=invitation.team_id AND m.user_id=p_user_id;
  IF member_role IS NULL THEN
    INSERT INTO public.team_members(team_id,user_id,role) VALUES(invitation.team_id,p_user_id,invitation.role);
    member_role := invitation.role;
  END IF;
  UPDATE public.team_invitations SET accepted_at=now() WHERE id=invitation.id;
  RETURN QUERY SELECT invitation.team_id,member_role;
END; $$;
REVOKE ALL ON FUNCTION public.accept_team_invitation(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text,uuid) TO authenticated;

""")

out.append("""
CREATE FUNCTION public.shroud_update_secret(p_project_id uuid,p_environment_id uuid,p_secret_id uuid,p_description text,p_is_required boolean,p_encrypted_value text DEFAULT NULL,p_encryption_version integer DEFAULT 1,p_update_description boolean DEFAULT true,p_update_required boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret public.secrets; new_version public.secret_versions;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.project_members m WHERE m.project_id=p_project_id AND m.user_id=auth.uid() AND m.role IN ('owner','admin','developer')) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  SELECT s.* INTO secret FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id WHERE s.id=p_secret_id AND e.id=p_environment_id AND e.project_id=p_project_id FOR UPDATE OF s;
  IF secret.id IS NULL THEN RAISE EXCEPTION 'Secret not found'; END IF;
  IF p_encrypted_value IS NOT NULL THEN
    new_version := public.create_secret_version(p_secret_id,p_encrypted_value,p_encryption_version,auth.uid());
  END IF;
  UPDATE public.secrets SET description=CASE WHEN p_update_description THEN p_description ELSE description END,is_required=CASE WHEN p_update_required THEN p_is_required ELSE is_required END,updated_at=now() WHERE id=p_secret_id RETURNING * INTO secret;
  RETURN jsonb_build_object('secret',to_jsonb(secret),'version',jsonb_build_object('version',new_version.version));
END; $$;
REVOKE ALL ON FUNCTION public.shroud_update_secret(uuid,uuid,uuid,text,boolean,text,integer,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_update_secret(uuid,uuid,uuid,text,boolean,text,integer,boolean,boolean) TO authenticated;

CREATE FUNCTION public.shroud_set_project_member(p_project_id uuid,p_user_id uuid,p_role public.project_role DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor_role public.project_role; target_role public.project_role; v_team_id uuid;
BEGIN
  SELECT p.team_id INTO v_team_id FROM public.projects p WHERE p.id=p_project_id FOR UPDATE;
  SELECT m.role INTO actor_role FROM public.project_members m WHERE m.project_id=p_project_id AND m.user_id=auth.uid();
  IF actor_role IS NULL OR actor_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  SELECT m.role INTO target_role FROM public.project_members m WHERE m.project_id=p_project_id AND m.user_id=p_user_id;
  IF target_role='owner' OR p_role='owner' OR (actor_role='admin' AND (target_role='admin' OR p_role='admin')) THEN
    RAISE EXCEPTION 'Only owners can manage admins; owner access cannot be changed here' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.team_members m WHERE m.team_id=v_team_id AND m.user_id=p_user_id) THEN RAISE EXCEPTION 'User is not a team member'; END IF;
  IF p_role IS NULL THEN
    DELETE FROM public.project_members WHERE project_id=p_project_id AND user_id=p_user_id;
  ELSE
    UPDATE public.project_members SET role=p_role WHERE project_id=p_project_id AND user_id=p_user_id;
    IF NOT FOUND THEN
      INSERT INTO public.project_members(project_id,user_id,role) VALUES(p_project_id,p_user_id,p_role);
    END IF;
  END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.shroud_set_project_member(uuid,uuid,public.project_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_set_project_member(uuid,uuid,public.project_role) TO authenticated;

-- The existing foreign keys do not cascade. Remove child rows in dependency order.
CREATE FUNCTION public.shroud_delete_secret(p_project_id uuid,p_environment_id uuid,p_secret_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_project_role(p_project_id,ARRAY['owner','admin']::public.project_role[]) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id
    WHERE s.id=p_secret_id AND e.id=p_environment_id AND e.project_id=p_project_id) THEN RETURN false; END IF;
  DELETE FROM public.secret_versions WHERE secret_id=p_secret_id;
  DELETE FROM public.secrets WHERE id=p_secret_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.shroud_delete_secret(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_delete_secret(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.shroud_delete_project(p_project_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_team_id uuid;
BEGIN
  SELECT p.team_id INTO v_team_id FROM public.projects p WHERE p.id=p_project_id FOR UPDATE;
  IF v_team_id IS NULL THEN RETURN false; END IF;
  IF NOT public.has_project_role(p_project_id,ARRAY['owner','admin']::public.project_role[]) THEN
    RAISE EXCEPTION 'Insufficient project access' USING ERRCODE='42501'; END IF;
  DELETE FROM public.project_invitations WHERE project_id=p_project_id;
  DELETE FROM public.required_keys WHERE project_id=p_project_id;
  DELETE FROM public.secret_versions v USING public.secrets s,public.environments e
    WHERE v.secret_id=s.id AND s.environment_id=e.id AND e.project_id=p_project_id;
  DELETE FROM public.secrets s USING public.environments e
    WHERE s.environment_id=e.id AND e.project_id=p_project_id;
  UPDATE public.audit_logs SET environment_id=NULL WHERE project_id=p_project_id;
  DELETE FROM public.environments WHERE project_id=p_project_id;
  DELETE FROM public.project_members WHERE project_id=p_project_id;
  UPDATE public.audit_logs SET project_id=NULL WHERE project_id=p_project_id;
  DELETE FROM public.projects WHERE id=p_project_id;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.shroud_delete_project(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shroud_delete_project(uuid) TO authenticated;

-- Preserve metadata on a CLI push unless the caller explicitly supplies it.
CREATE OR REPLACE FUNCTION shroud_private.create_secret_for_api_token(p_team_id uuid,p_project_id uuid,p_environment_id uuid,p_key text,p_description text,p_is_required boolean,p_encrypted_value text,p_encryption_version integer,p_created_by uuid)
RETURNS TABLE(id uuid,key text,description text,is_required boolean,version integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_secret_id uuid; next_version integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects p JOIN public.environments e ON e.project_id=p.id WHERE p.id=p_project_id AND p.team_id=p_team_id AND e.id=p_environment_id) THEN RAISE EXCEPTION 'Environment not found'; END IF;
  SELECT s.id INTO v_secret_id FROM public.secrets s WHERE s.environment_id=p_environment_id AND s.key=p_key FOR UPDATE;
  IF v_secret_id IS NULL THEN
    INSERT INTO public.secrets(environment_id,key,description,is_required,created_by) VALUES(p_environment_id,p_key,p_description,coalesce(p_is_required,false),p_created_by) RETURNING public.secrets.id INTO v_secret_id;
  ELSE
    UPDATE public.secrets s SET description=coalesce(p_description,s.description),is_required=coalesce(p_is_required,s.is_required),updated_at=now() WHERE s.id=v_secret_id;
  END IF;
  SELECT coalesce(max(v.version),0)+1 INTO next_version FROM public.secret_versions v WHERE v.secret_id=v_secret_id;
  INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(v_secret_id,next_version,p_encrypted_value,p_encryption_version,p_created_by);
  RETURN QUERY SELECT s.id,s.key,s.description,s.is_required,next_version FROM public.secrets s WHERE s.id=v_secret_id;
END; $$;
COMMIT;
""")

path = Path("supabase/migrations/202610120001_complete_core.sql")
path.parent.mkdir(parents=True, exist_ok=True)
sql = "\n".join(out)
sql = sql.replace("CREATE FUNCTION ", "CREATE OR REPLACE FUNCTION ")
sql = sql.replace("CREATE TABLE shroud_private.token_rate_limits", "CREATE TABLE IF NOT EXISTS shroud_private.token_rate_limits")
def move_once(match):
    name, types = match.groups()
    signature = f"shroud_private.{name}({types})"
    return f"DO $move$ BEGIN IF to_regprocedure('{signature}') IS NULL THEN ALTER FUNCTION public.{name}({types}) SET SCHEMA shroud_private; END IF; END $move$;"
sql = re.sub(r"ALTER FUNCTION public\.(\w+)\(([^;]+)\) SET SCHEMA shroud_private;", move_once, sql)
sql = sql.replace("EXECUTE format('CREATE TRIGGER shroud_audit_mutation", "EXECUTE format('DROP TRIGGER IF EXISTS shroud_audit_mutation ON public.%I',table_name);\n    EXECUTE format('CREATE TRIGGER shroud_audit_mutation")
path.write_text(sql, encoding="utf-8")
print(f"Generated {path}")
