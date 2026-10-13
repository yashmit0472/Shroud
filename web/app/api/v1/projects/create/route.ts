import { NextResponse } from "next/server";
import { canWrite, teamAccess } from "@/lib/workspace-access";

export async function POST(request: Request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body.team_id !== "string" || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100 || (body.description != null && typeof body.description !== "string")) {
    return NextResponse.json({ error: "Provide a team and a project name of 1–100 characters" }, { status: 400 });
  }
  const access = await teamAccess(body.team_id);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this team" }, { status: access.status });
  if (!canWrite(access.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { data, error } = await access.supabase.rpc("shroud_create_project", { p_team_id: body.team_id, p_name: body.name.trim(), p_description: body.description?.trim() || null });
  if (error || typeof data !== "string") return NextResponse.json({ error: "Unable to create project. Check that the core database migration has been applied." }, { status: 500 });
  return NextResponse.json({ project_id: data }, { status: 201 });
}
