import { NextResponse } from "next/server";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { canManage, projectAccess } from "@/lib/workspace-access";

export async function DELETE(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await projectAccess(projectId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this project" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only project owners and admins can delete projects" }, { status: 403 });
  if (!await isActiveWorkspaceProject(projectId)) return NextResponse.json({ error: "Select this project's workspace first." }, { status: 403 });
  let body;try{body=await request.json();}catch{body={};}
  const { data, error } = await access.supabase.rpc("shroud_delete_project_confirmed", { p_project_id: projectId,p_confirm_production:body.confirm_production===true });
  if (error) return NextResponse.json({ error: error.code === "P0400" ? "Confirm Production deletion. Disable required approval in project settings before deleting the project." : "Unable to delete project. Check database setup.",code:error.code }, { status: error.code === "P0400" ? 409 : error.code === "42501" ? 403 : 500 });
  if (!data) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
