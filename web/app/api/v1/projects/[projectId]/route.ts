import { NextResponse } from "next/server";
import { canManage, projectAccess } from "@/lib/workspace-access";

export async function DELETE(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await projectAccess(projectId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this project" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only project owners and admins can delete projects" }, { status: 403 });
  const { data, error } = await access.supabase.rpc("shroud_delete_project", { p_project_id: projectId });
  if (error) return NextResponse.json({ error: "Unable to delete project. Check the core database migration." }, { status: error.code === "42501" ? 403 : 500 });
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
