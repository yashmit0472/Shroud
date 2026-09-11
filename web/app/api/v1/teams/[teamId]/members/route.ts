import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
    params: Promise<{
        teamId: string;
    }>;
};

export async function GET(
    request: Request,
    { params }: RouteContext,
) {
    const { teamId } = await params;

    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 },
        );
    }

    const { data, error } = await supabase.rpc(
        "list_team_members",
        {
            p_team_id: teamId,
            p_user_id: user.id,
        },
    );

    if (error) {
        console.error(
            "Failed to load team members:",
            error,
        );

        if (error.message.includes("Not a team member")) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Failed to load team members" },
            { status: 500 },
        );
    }

    return NextResponse.json({
        members: data ?? [],
    });
}
