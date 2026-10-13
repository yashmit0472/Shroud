import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";

export async function GET(request: Request) {
    const auth = await authenticateApiToken(request);

    if (!auth.token) {
        return NextResponse.json(
            { error: auth.error },
            { status: 401 }
        );
    }

    if (!auth.token.scopes.includes("secrets:read")) {
        return NextResponse.json(
            { error: "Insufficient token scope" },
            { status: 403 }
        );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
        "list_projects_for_api_token",
        {
            p_team_id: auth.token.team_id,
            p_token_hash: auth.token.hash,
        },
    );

    if (error) {
        if (error.code === "P0429") return NextResponse.json({ error: "Token rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
        if (error.code === "42501") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        console.error("Failed to list projects:", error);

        return NextResponse.json(
            { error: "Failed to load projects" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        projects: data ?? [],
    });
}
