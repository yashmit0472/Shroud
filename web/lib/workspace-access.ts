import { createClient } from "@/lib/supabase/server";

export async function teamAccess(teamId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { supabase, userId: null, role: null, status: 401 };
  const { data: membership, error: membershipError } = await supabase
    .from("team_members").select("role").eq("team_id", teamId).eq("user_id", userId).maybeSingle();
  if (membershipError) return { supabase, userId, role: null, status: 500 };
  if (!membership) return { supabase, userId, role: null, status: 403 };
  return { supabase, userId, role: membership.role as string, status: 200 };
}

export async function projectAccess(projectId: string, environmentId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return { supabase, userId: null, role: null, status: 401 };
  const { data: membership, error: membershipError } = await supabase
    .from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
  if (membershipError) return { supabase, userId, role: null, status: 500 };
  if (!membership) return { supabase, userId, role: null, status: 403 };
  if (environmentId) {
    const { data: environment, error: environmentError } = await supabase
      .from("environments").select("id").eq("id", environmentId).eq("project_id", projectId).maybeSingle();
    if (environmentError) return { supabase, userId, role: null, status: 500 };
    if (!environment) return { supabase, userId, role: null, status: 404 };
  }
  return { supabase, userId, role: membership.role as string, status: 200 };
}

export const canManage = (role: string | null) => role === "owner" || role === "admin";
export const canWrite = (role: string | null) => canManage(role) || role === "developer";
