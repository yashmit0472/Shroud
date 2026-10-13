import { NextResponse } from "next/server";
import { canManage, projectAccess } from "@/lib/workspace-access";

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await projectAccess(projectId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this project" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body.user_id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.user_id) || (body.role !== null && !["admin", "developer", "viewer"].includes(body.role))) return NextResponse.json({ error: "Provide a team member and a valid role" }, { status: 400 });
  const { error } = await access.supabase.rpc("shroud_set_project_member", { p_project_id: projectId, p_user_id: body.user_id, p_role: body.role });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "You cannot change access for this member" : "Unable to change project access" }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json({ success: true });
}
