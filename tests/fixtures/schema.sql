-- Minimal local reproduction of the tables and contracts supplied by the user.
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth; CREATE SCHEMA extensions;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('email',current_setting('request.jwt.claim.email',true)) $$;
CREATE FUNCTION extensions.digest(value text, algorithm text) RETURNS bytea LANGUAGE sql AS $$ SELECT sha256(convert_to(value,'UTF8')) $$;
CREATE TYPE public.team_role AS ENUM('owner','admin','developer','viewer');
CREATE TYPE public.project_role AS ENUM('owner','admin','developer','viewer');
CREATE TYPE public.environment_type AS ENUM('development','staging','production');
CREATE TABLE profiles(id uuid PRIMARY KEY, full_name text,avatar_url text);
CREATE TABLE teams(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,slug text,owner_id uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE team_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,user_id uuid,role team_role,created_at timestamptz DEFAULT now(), UNIQUE(team_id,user_id));
CREATE TABLE projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,name text,slug text,description text,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE project_members(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,user_id uuid,role project_role,created_at timestamptz DEFAULT now());
CREATE TABLE project_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,email text,role project_role,token_hash text,invite_code_hash text,invited_by uuid,expires_at timestamptz,accepted_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE environments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,name text,slug text,type environment_type,created_at timestamptz DEFAULT now());
CREATE TABLE secrets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),environment_id uuid,key text,description text,is_required boolean NOT NULL DEFAULT false,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),UNIQUE(environment_id,key));
CREATE TABLE secret_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),secret_id uuid,version integer,encrypted_value text,encryption_version integer DEFAULT 1,created_by uuid,created_at timestamptz DEFAULT now(),UNIQUE(secret_id,version));
CREATE TABLE required_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,key text,created_by uuid,created_at timestamptz DEFAULT now());
CREATE TABLE api_tokens(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,created_by uuid,name text,token_prefix text,token_hash text,scopes jsonb,expires_at timestamptz,revoked_at timestamptz,last_used_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE audit_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,actor_id uuid,token_id uuid,action text,resource_type text,resource_id uuid,project_id uuid,environment_id uuid,metadata jsonb,ip_address inet,user_agent text,created_at timestamptz DEFAULT now());
CREATE TABLE notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,team_id uuid,type text,title text,message text,metadata jsonb,read_at timestamptz,created_at timestamptz DEFAULT now());
CREATE TABLE subscriptions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,plan text,status text,created_at timestamptz DEFAULT now());
CREATE TABLE team_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid,role team_role,email text,invited_by uuid,token_hash text,invite_code_hash text,expires_at timestamptz,accepted_at timestamptz,created_at timestamptz DEFAULT now());
ALTER TABLE project_members ADD FOREIGN KEY(project_id) REFERENCES projects(id);
ALTER TABLE project_invitations ADD FOREIGN KEY(project_id) REFERENCES projects(id);
ALTER TABLE environments ADD FOREIGN KEY(project_id) REFERENCES projects(id);
ALTER TABLE secrets ADD FOREIGN KEY(environment_id) REFERENCES environments(id);
ALTER TABLE secret_versions ADD FOREIGN KEY(secret_id) REFERENCES secrets(id);
ALTER TABLE required_keys ADD FOREIGN KEY(project_id) REFERENCES projects(id);
ALTER TABLE audit_logs ADD FOREIGN KEY(project_id) REFERENCES projects(id);
ALTER TABLE audit_logs ADD FOREIGN KEY(environment_id) REFERENCES environments(id);
CREATE FUNCTION public.is_project_member(target_project_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=target_project_id AND user_id=auth.uid()) $$;
CREATE FUNCTION public.has_project_role(target_project_id uuid,allowed_roles project_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.project_members WHERE project_id=target_project_id AND user_id=auth.uid() AND role=ANY(allowed_roles)) $$;
CREATE FUNCTION public.has_team_role(target_team_id uuid,allowed_roles team_role[]) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=target_team_id AND user_id=auth.uid() AND role=ANY(allowed_roles)) $$;
CREATE FUNCTION public.create_secret_with_version(p_environment_id uuid,p_key text,p_description text,p_is_required boolean,p_encrypted_value text,p_encryption_version integer,p_created_by uuid) RETURNS public.secrets LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE s public.secrets; BEGIN
INSERT INTO public.secrets(environment_id,key,description,is_required,created_by) VALUES(p_environment_id,p_key,p_description,p_is_required,p_created_by) RETURNING * INTO s;
INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(s.id,1,p_encrypted_value,p_encryption_version,p_created_by); RETURN s; END $$;
CREATE FUNCTION public.create_secret_version(p_secret_id uuid,p_encrypted_value text,p_encryption_version integer,p_created_by uuid) RETURNS public.secret_versions LANGUAGE plpgsql SECURITY DEFINER AS $$ DECLARE v public.secret_versions; n integer; BEGIN
SELECT coalesce(max(version),0)+1 INTO n FROM public.secret_versions WHERE secret_id=p_secret_id;
INSERT INTO public.secret_versions(secret_id,version,encrypted_value,encryption_version,created_by) VALUES(p_secret_id,n,p_encrypted_value,p_encryption_version,p_created_by) RETURNING * INTO v; RETURN v; END $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE SELECT,INSERT,UPDATE,DELETE ON required_keys,api_tokens,audit_logs,notifications,subscriptions FROM authenticated;

