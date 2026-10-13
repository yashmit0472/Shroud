import { NextResponse } from "next/server";
import { canManage, projectAccess } from "@/lib/workspace-access";
type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: Context) {
  const { projectId } = await params;
  const access = await projectAccess(projectId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this project" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only owners and admins can manage required keys" }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body.key !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.key)) return NextResponse.json({ error: "Enter a valid environment variable name" }, { status: 400 });
  const { error } = await access.supabase.from("required_keys").insert({ project_id: projectId, key: body.key, created_by: access.userId });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "This key is already required" : "Unable to add required key" }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { projectId } = await params;
  const access = await projectAccess(projectId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this project" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  const { error } = await access.supabase.from("required_keys").delete().eq("project_id", projectId).eq("key", key);
  if (error) return NextResponse.json({ error: "Unable to remove required key" }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
