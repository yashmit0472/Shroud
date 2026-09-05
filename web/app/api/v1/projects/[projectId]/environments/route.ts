import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";

type RouteContext = {
    params: Promise<{
        projectId: string;
    }>;
};

export async function GET(
    request: Request,
    { params }: RouteContext,
) {
    const { projectId } = await params;

    const auth = await authenticateApiToken(request);

    if (!auth.token) {
        return NextResponse.json(
            { error: auth.error },
            { status: 401 },
        );
    }

    if (!auth.token.scopes.includes("secrets:read")) {
        return NextResponse.json(
            { error: "Insufficient token scope" },
            { status: 403 },
        );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
        "list_environments_for_api_token",
        {
            p_team_id: auth.token.team_id,
            p_project_id: projectId,
        },
    );

    if (error) {
        console.error("Failed to list environments:", error);

        return NextResponse.json(
            { error: "Failed to load environments" },
            { status: 500 },
        );
    }

    return NextResponse.json({
        environments: data ?? [],
    });
}
