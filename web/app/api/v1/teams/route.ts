import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";

export async function GET(request: Request) {
    const auth = await authenticateApiToken(request);

    if (!auth.token) {
        return NextResponse.json(
            { error: auth.error },
            { status: 401 },
        );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
        "get_team_for_api_token",
        {
            p_team_id: auth.token.team_id,
        },
    );

    if (error) {
        console.error("Failed to load team:", error);

        return NextResponse.json(
            { error: "Failed to load team" },
            { status: 500 },
        );
    }

    const team = data?.[0];

    if (!team) {
        return NextResponse.json(
            { error: "Team not found" },
            { status: 404 },
        );
    }

    return NextResponse.json({
        teams: [
            {
                ...team,
                role: "developer",
            },
        ],
    });
}
