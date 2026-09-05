import { NextResponse } from "next/server";
import { authenticateApiToken } from "@/lib/api-auth";

export async function GET(request: Request) {
  const result = await authenticateApiToken(request);

  if (!result.token) {
    return NextResponse.json(
      { error: result.error },
      { status: 401 },
    );
  }

  return NextResponse.json({
    authenticated: true,
    team_id: result.token.team_id,
    created_by: result.token.created_by,
    scopes: result.token.scopes,
  });
}
