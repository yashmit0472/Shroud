import { NextResponse } from "next/server";
import { canManage, teamAccess } from "@/lib/workspace-access";

export async function DELETE(request: Request, { params }: { params: Promise<{ tokenId: string }> }) {
  const teamId = new URL(request.url).searchParams.get("team_id");
  if (!teamId) return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  const access = await teamAccess(teamId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this team" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only owners and admins can revoke tokens" }, { status: 403 });
  const { tokenId } = await params;
  const { data, error } = await access.supabase.rpc("shroud_revoke_api_token", { p_token_id: tokenId, p_team_id: teamId });
  if (error) return NextResponse.json({ error: "Unable to revoke token" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Token not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
