import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateApiToken } from "@/lib/api-token";

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

  if (!body.team_id || !body.name?.trim()) {
    return NextResponse.json(
      { error: "team_id and name are required" },
      { status: 400 },
    );
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
      scopes: body.scopes ?? ["secrets:read"],
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
    { status: 201 },
  );
}
