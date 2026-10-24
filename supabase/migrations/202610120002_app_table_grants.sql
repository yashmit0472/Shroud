BEGIN;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles, public.teams, public.team_members, public.projects, public.project_members,
  public.environments, public.secrets, public.required_keys, public.api_tokens, public.audit_logs,
  public.notifications, public.subscriptions TO authenticated;
GRANT UPDATE ON public.profiles, public.teams, public.projects, public.environments,
  public.secrets, public.notifications TO authenticated;
GRANT INSERT ON public.projects, public.environments, public.secrets, public.required_keys, public.api_tokens TO authenticated;
GRANT UPDATE, DELETE ON public.required_keys TO authenticated;
REVOKE ALL ON public.secret_versions, public.team_invitations, public.project_invitations FROM anon, authenticated;
COMMIT;
