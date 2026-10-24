-- Fresh Supabase installation only. Existing Shroud databases skip this file.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE TYPE public.team_role AS ENUM ('owner','admin','developer','viewer');
CREATE TYPE public.project_role AS ENUM ('owner','admin','developer','viewer');
CREATE TYPE public.environment_type AS ENUM ('development','staging','production');
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,full_name text,avatar_url text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,slug text NOT NULL UNIQUE,owner_id uuid NOT NULL REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.team_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,role public.team_role NOT NULL DEFAULT 'developer',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(team_id,user_id));
CREATE TABLE public.projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,name text NOT NULL,slug text NOT NULL UNIQUE,description text,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.project_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,role public.project_role NOT NULL DEFAULT 'developer',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,user_id));
CREATE TABLE public.environments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,name text NOT NULL,slug text NOT NULL,type public.environment_type NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,slug));
CREATE TABLE public.secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,key text NOT NULL,description text,is_required boolean NOT NULL DEFAULT false,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(environment_id,key));
CREATE TABLE public.secret_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret_id uuid NOT NULL REFERENCES public.secrets(id) ON DELETE CASCADE,version integer NOT NULL CHECK(version>0),encrypted_value text NOT NULL,encryption_version integer NOT NULL DEFAULT 1,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(secret_id,version));
CREATE TABLE public.required_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,key text NOT NULL,created_by uuid REFERENCES auth.users(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(project_id,key));
CREATE TABLE public.api_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,created_by uuid NOT NULL REFERENCES auth.users(id),name text NOT NULL,token_prefix text NOT NULL,token_hash text NOT NULL UNIQUE,scopes jsonb NOT NULL DEFAULT '[]',last_used_at timestamptz,expires_at timestamptz,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,token_id uuid REFERENCES public.api_tokens(id) ON DELETE SET NULL,action text NOT NULL,resource_type text,resource_id uuid,project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,ip_address inet,user_agent text,metadata jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,type text NOT NULL,title text NOT NULL,message text NOT NULL,metadata jsonb,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,plan text NOT NULL DEFAULT 'free',stripe_customer_id text,stripe_subscription_id text,status text NOT NULL DEFAULT 'active',current_period_start timestamptz,current_period_end timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.team_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,email text,role public.team_role NOT NULL DEFAULT 'developer',token_hash text NOT NULL UNIQUE,invite_code_hash text NOT NULL,invited_by uuid NOT NULL REFERENCES auth.users(id),expires_at timestamptz NOT NULL,accepted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.project_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,email text,role public.project_role NOT NULL DEFAULT 'developer',token_hash text NOT NULL UNIQUE,invite_code_hash text NOT NULL,invited_by uuid NOT NULL REFERENCES auth.users(id),expires_at timestamptz NOT NULL,accepted_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX ON public.team_members(user_id);
CREATE INDEX ON public.project_members(user_id);
CREATE INDEX ON public.audit_logs(team_id,created_at DESC);
CREATE INDEX ON public.secret_versions(secret_id,version DESC);
CREATE FUNCTION public.is_team_member(target_team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=target_team_id AND user_id=auth.uid()) $$;
CREATE FUNCTION public.has_team_role(target_team_id uuid,allowed_roles public.team_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=target_team_id AND user_id=auth.uid() AND role=ANY(allowed_roles)) $$;
CREATE FUNCTION public.is_project_member(target_project_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=target_project_id AND user_id=auth.uid()) $$;
CREATE FUNCTION public.has_project_role(target_project_id uuid,allowed_roles public.project_role[]) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=target_project_id AND user_id=auth.uid() AND role=ANY(allowed_roles)) $$;
CREATE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN INSERT INTO public.profiles(id,full_name,avatar_url) VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name'),NEW.raw_user_meta_data->>'avatar_url') ON CONFLICT(id) DO NOTHING; RETURN NEW; END $$;
CREATE TRIGGER shroud_new_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER profile_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER team_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER project_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER secret_updated BEFORE UPDATE ON public.secrets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.create_secret_with_version(p_environment_id uuid,p_key text,p_description text,p_is_required boolean,p_encrypted_value text,p_encryption_version integer,p_created_by uuid)
RETURNS public.secrets LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.secrets;
BEGIN
  INSERT INTO public.secrets(environment_id,key,description,is_required,created_by) VALUES(p_environment_id,p_key,p_description,p_is_required,p_created_by) RETURNING * INTO s;
  INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(s.id,1,p_encrypted_value,p_encryption_version,p_created_by);
  RETURN s;
END $$;
CREATE FUNCTION public.create_secret_version(p_secret_id uuid,p_encrypted_value text,p_encryption_version integer,p_created_by uuid)
RETURNS public.secret_versions LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.secret_versions; n integer;
BEGIN
  SELECT coalesce(max(version),0)+1 INTO n FROM public.secret_versions WHERE secret_id=p_secret_id;
  INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(p_secret_id,n,p_encrypted_value,p_encryption_version,p_created_by) RETURNING * INTO v;
  RETURN v;
END $$;
CREATE FUNCTION public.validate_api_token(p_token_hash text)
RETURNS TABLE(token_id uuid,team_id uuid,created_by uuid,scopes jsonb) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
UPDATE public.api_tokens SET last_used_at=now() WHERE token_hash=p_token_hash AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())
AND EXISTS(SELECT 1 FROM public.team_members tm WHERE tm.team_id=api_tokens.team_id AND tm.user_id=api_tokens.created_by)
RETURNING id,team_id,created_by,scopes $$;
CREATE FUNCTION public.list_projects_for_api_token(p_team_id uuid)
RETURNS TABLE(id uuid,name text,slug text,description text,created_at timestamptz,updated_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT id,name,slug,description,created_at,updated_at FROM public.projects WHERE team_id=p_team_id ORDER BY name $$;
CREATE FUNCTION public.list_environments_for_api_token(p_team_id uuid,p_project_id uuid)
RETURNS TABLE(id uuid,project_id uuid,name text,slug text,type public.environment_type,created_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT e.id,e.project_id,e.name,e.slug,e.type,e.created_at FROM public.environments e JOIN public.projects p ON p.id=e.project_id WHERE p.team_id=p_team_id AND p.id=p_project_id ORDER BY e.created_at $$;
CREATE FUNCTION public.list_secrets_for_api_token(p_team_id uuid,p_project_id uuid,p_environment_id uuid)
RETURNS TABLE(id uuid,key text,description text,is_required boolean) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT s.id,s.key,s.description,s.is_required FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id JOIN public.projects p ON p.id=e.project_id WHERE p.team_id=p_team_id AND p.id=p_project_id AND e.id=p_environment_id ORDER BY s.key $$;
CREATE FUNCTION public.get_secret_value_for_api_token(p_team_id uuid,p_project_id uuid,p_environment_id uuid,p_secret_id uuid)
RETURNS TABLE(id uuid,key text,encrypted_value text,encryption_version integer) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT s.id,s.key,v.encrypted_value,v.encryption_version FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id JOIN public.projects p ON p.id=e.project_id JOIN LATERAL(SELECT encrypted_value,encryption_version FROM public.secret_versions WHERE secret_id=s.id ORDER BY version DESC LIMIT 1)v ON true WHERE p.team_id=p_team_id AND p.id=p_project_id AND e.id=p_environment_id AND s.id=p_secret_id $$;
CREATE FUNCTION public.get_all_secret_values_for_api_token(p_team_id uuid,p_project_id uuid,p_environment_id uuid)
RETURNS TABLE(id uuid,key text,encrypted_value text,encryption_version integer) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT s.id,s.key,v.encrypted_value,v.encryption_version FROM public.secrets s JOIN public.environments e ON e.id=s.environment_id JOIN public.projects p ON p.id=e.project_id JOIN LATERAL(SELECT encrypted_value,encryption_version FROM public.secret_versions WHERE secret_id=s.id ORDER BY version DESC LIMIT 1)v ON true WHERE p.team_id=p_team_id AND p.id=p_project_id AND e.id=p_environment_id ORDER BY s.key $$;
CREATE FUNCTION public.get_team_for_api_token(p_team_id uuid)
RETURNS TABLE(id uuid,name text,slug text,owner_id uuid,created_at timestamptz,updated_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT id,name,slug,owner_id,created_at,updated_at FROM public.teams WHERE id=p_team_id $$;
CREATE FUNCTION public.create_secret_for_api_token(p_team_id uuid,p_project_id uuid,p_environment_id uuid,p_key text,p_description text,p_is_required boolean,p_encrypted_value text,p_encryption_version integer,p_created_by uuid)
RETURNS TABLE(id uuid,key text,description text,is_required boolean,version integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Core security migration required' USING ERRCODE='42501'; END $$;
CREATE FUNCTION public.create_team_invitation(p_team_id uuid,p_invited_by uuid,p_role public.team_role,p_expires_at timestamptz)
RETURNS TABLE(id uuid,team_id uuid,role public.team_role,token text,invite_code text,expires_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE raw_token text:=encode(extensions.gen_random_bytes(32),'hex'); raw_code text:=upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,8)); invitation_id uuid;
BEGIN
  INSERT INTO public.team_invitations(team_id,invited_by,role,token_hash,invite_code_hash,expires_at) VALUES(p_team_id,p_invited_by,p_role,encode(extensions.digest(raw_token,'sha256'),'hex'),encode(extensions.digest(raw_code,'sha256'),'hex'),p_expires_at) RETURNING public.team_invitations.id INTO invitation_id;
  RETURN QUERY SELECT invitation_id,p_team_id,p_role,raw_token,raw_code,p_expires_at;
END $$;
CREATE FUNCTION public.list_team_members(p_team_id uuid,p_user_id uuid)
RETURNS TABLE(id uuid,user_id uuid,full_name text,avatar_url text,role public.team_role,created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT tm.id,tm.user_id,p.full_name,p.avatar_url,tm.role,tm.created_at FROM public.team_members tm LEFT JOIN public.profiles p ON p.id=tm.user_id WHERE tm.team_id=p_team_id ORDER BY tm.role,tm.created_at;
END $$;
CREATE FUNCTION public.list_team_invitations(p_team_id uuid,p_user_id uuid)
RETURNS TABLE(id uuid,role public.team_role,expires_at timestamptz,created_at timestamptz,invited_by uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.has_team_role(p_team_id,ARRAY['owner','admin']::public.team_role[]) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  RETURN QUERY SELECT i.id,i.role,i.expires_at,i.created_at,i.invited_by FROM public.team_invitations i WHERE i.team_id=p_team_id AND i.accepted_at IS NULL AND i.expires_at>now() ORDER BY i.created_at DESC;
END $$;
CREATE FUNCTION public.remove_team_member(p_team_id uuid,p_target_user_id uuid,p_requester_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE requester public.team_role; target public.team_role;
BEGIN
  SELECT role INTO requester FROM public.team_members WHERE team_id=p_team_id AND user_id=p_requester_id;
  SELECT role INTO target FROM public.team_members WHERE team_id=p_team_id AND user_id=p_target_user_id;
  IF requester IS NULL OR requester NOT IN ('owner','admin') OR target IS NULL OR target='owner' OR (requester='admin' AND target='admin') THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  DELETE FROM public.team_members WHERE team_id=p_team_id AND user_id=p_target_user_id; RETURN true;
END $$;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['profiles','teams','team_members','projects','project_members','environments','secrets','secret_versions','required_keys','api_tokens','audit_logs','notifications','subscriptions','team_invitations','project_invitations'] LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t); END LOOP; END $$;
CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY teams_select_member ON public.teams FOR SELECT TO authenticated USING(public.is_team_member(id));
CREATE POLICY teams_update_admin ON public.teams FOR UPDATE TO authenticated USING(public.has_team_role(id,ARRAY['owner','admin']::public.team_role[])) WITH CHECK(public.has_team_role(id,ARRAY['owner','admin']::public.team_role[]));
CREATE POLICY team_members_select_member ON public.team_members FOR SELECT TO authenticated USING(public.is_team_member(team_id));
CREATE POLICY projects_select_member ON public.projects FOR SELECT TO authenticated USING(public.is_team_member(team_id));
CREATE POLICY projects_update_project_admin ON public.projects FOR UPDATE TO authenticated USING(public.has_project_role(id,ARRAY['owner','admin']::public.project_role[])) WITH CHECK(public.has_project_role(id,ARRAY['owner','admin']::public.project_role[]));
CREATE POLICY project_members_select_member ON public.project_members FOR SELECT TO authenticated USING(public.is_project_member(project_id));
CREATE POLICY environments_select_project ON public.environments FOR SELECT TO authenticated USING(public.is_project_member(project_id));
CREATE POLICY secrets_select_project ON public.secrets FOR SELECT TO authenticated USING(public.is_project_member((SELECT project_id FROM public.environments WHERE id=environment_id)));
CREATE POLICY required_keys_select_project ON public.required_keys FOR SELECT TO authenticated USING(public.is_project_member(project_id));
CREATE POLICY required_keys_insert_admin ON public.required_keys FOR INSERT TO authenticated WITH CHECK(public.has_project_role(project_id,ARRAY['owner','admin']::public.project_role[]) AND created_by=auth.uid());
CREATE POLICY required_keys_delete_admin ON public.required_keys FOR DELETE TO authenticated USING(public.has_project_role(project_id,ARRAY['owner','admin']::public.project_role[]));
CREATE POLICY api_tokens_select_admin ON public.api_tokens FOR SELECT TO authenticated USING(public.has_team_role(team_id,ARRAY['owner','admin']::public.team_role[]));
CREATE POLICY api_tokens_insert_admin ON public.api_tokens FOR INSERT TO authenticated WITH CHECK(public.has_team_role(team_id,ARRAY['owner','admin']::public.team_role[]) AND created_by=auth.uid());
CREATE POLICY audit_logs_select_member ON public.audit_logs FOR SELECT TO authenticated USING(public.is_team_member(team_id));
CREATE POLICY notifications_select_self ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_update_self ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY subscriptions_select_admin ON public.subscriptions FOR SELECT TO authenticated USING(public.has_team_role(team_id,ARRAY['owner','admin']::public.team_role[]));
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid),public.is_project_member(uuid),public.has_team_role(uuid,public.team_role[]),public.has_project_role(uuid,public.project_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_api_token(text) TO anon,authenticated;
COMMIT;
