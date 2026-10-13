import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { selectWorkspace, workspaceCookieName, Workspace, WorkspaceRole } from "@/lib/workspace-selection";

export const getWorkspaceContext = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : data?.claims?.sub ?? null;
  if (!userId) return { supabase, userId: null, workspaces: [] as Workspace[], workspace: null };
  const { data: memberships, error: membershipError } = await supabase.from("team_members").select("team_id, role, created_at").eq("user_id", userId).order("created_at").order("team_id");
  if (membershipError) throw new Error("Unable to load your workspaces.");
  if (!memberships?.length) return { supabase, userId, workspaces: [] as Workspace[], workspace: null };
  const { data: teams, error: teamError } = await supabase.from("teams").select("id, name, slug").in("id", memberships.map((membership) => membership.team_id));
  if (teamError) throw new Error("Unable to load your workspaces.");
  const workspaces = memberships.flatMap((membership) => {
    const team = teams?.find((item) => item.id === membership.team_id);
    return team ? [{ ...team, role: membership.role as WorkspaceRole }] : [];
  });
  const selectedId = (await cookies()).get(workspaceCookieName)?.value;
  return { supabase, userId, workspaces, workspace: selectWorkspace(workspaces, selectedId) };
});

export async function requireWorkspace() {
  const context = await getWorkspaceContext();
  if (!context.userId) redirect("/login");
  if (!context.workspace) redirect("/onboarding");
  return { ...context, userId: context.userId, workspace: context.workspace, membership: { team_id: context.workspace.id, role: context.workspace.role } };
}

export async function isActiveWorkspaceProject(projectId: string) {
  const context = await getWorkspaceContext();
  if (!context.workspace) return false;
  const { data, error } = await context.supabase.from("projects").select("id").eq("id", projectId).eq("team_id", context.workspace.id).maybeSingle();
  return !error && !!data;
}
