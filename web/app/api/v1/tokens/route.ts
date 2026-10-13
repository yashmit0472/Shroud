import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiToken } from "@/lib/api-token";
import { canManage, teamAccess } from "@/lib/workspace-access";

export async function GET(request: Request) {
  const teamId = new URL(request.url).searchParams.get("team_id");
  if (!teamId) return NextResponse.json({ error: "team_id is required" }, { status: 400 });
  const access = await teamAccess(teamId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this team" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only owners and admins can manage tokens" }, { status: 403 });
  const { data, error } = await access.supabase.from("api_tokens")
    .select("id, name, token_prefix, scopes, expires_at, created_at, last_used_at, revoked_at")
    .eq("team_id", teamId).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load tokens" }, { status: 500 });
  return NextResponse.json({ tokens: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const userId = claimsData.claims.sub;

  let body: {
    team_id?: string;
    name?: string;
    expires_at?: string | null;
    scopes?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body || typeof body.team_id !== "string" || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
    return NextResponse.json(
      { error: "team_id and name are required" },
      { status: 400 },
    );
  }

  const allowedScopes = ["secrets:read", "secrets:write"];
  if (body.scopes !== undefined && (!Array.isArray(body.scopes) || body.scopes.length === 0 || body.scopes.some((scope) => !allowedScopes.includes(scope)))) {
    return NextResponse.json({ error: "Select valid token scopes" }, { status: 400 });
  }
  if (body.expires_at != null && (typeof body.expires_at !== "string" || !Number.isFinite(Date.parse(body.expires_at)) || Date.parse(body.expires_at) <= Date.now())) {
    return NextResponse.json({ error: "Expiration must be a future date" }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", body.team_id)
    .eq("user_id", userId)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "You are not a member of this team" },
      { status: 403 },
    );
  }

  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const { token, prefix, hash } = generateApiToken();

  const { data: apiToken, error } = await supabase
    .from("api_tokens")
    .insert({
      team_id: body.team_id,
      created_by: userId,
      name: body.name.trim(),
      token_prefix: prefix,
      token_hash: hash,
      scopes: body.scopes ?? ["secrets:read", "secrets:write"],
      expires_at: body.expires_at ?? null,
    })
    .select(
      "id, team_id, name, token_prefix, scopes, expires_at, created_at",
    )
    .single();

  if (error) {
    console.error("Failed to create API token:", error);

    return NextResponse.json(
      { error: "Failed to create API token" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      token: apiToken,
      secret: token,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
