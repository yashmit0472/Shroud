import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";

type ApiToken = {
  token_id: string;
  team_id: string;
  created_by: string;
  scopes: string[];
};

export async function authenticateApiToken(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      token: null,
      error: "Missing API token",
    };
  }

  const rawToken = authorization.slice("Bearer ".length).trim();

  if (!rawToken) {
    return {
      token: null,
      error: "Missing API token",
    };
  }

  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "validate_api_token",
    {
      p_token_hash: tokenHash,
    },
  );

  if (error) {
    console.error("API token validation error:", error);

    return {
      token: null,
      error: "Unable to validate API token",
    };
  }

  const token = data?.[0];

  if (!token) {
    return {
      token: null,
      error: "Invalid or expired API token",
    };
  }

  return {
    token: {
      token_id: token.token_id,
      team_id: token.team_id,
      created_by: token.created_by,
      scopes: Array.isArray(token.scopes) ? token.scopes : [],
    } as ApiToken,
    error: null,
  };
}
