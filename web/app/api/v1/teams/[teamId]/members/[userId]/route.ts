import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
    params: Promise<{
        teamId: string;
        userId: string;
    }>;
};

export async function DELETE(
    request: Request,
    { params }: RouteContext,
) {
    const { teamId, userId } = await params;

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

    const { error } = await supabase.rpc(
        "remove_team_member",
        {
            p_team_id: teamId,
            p_target_user_id: userId,
            p_requester_id: user.id,
        },
    );

    if (error) {
        console.error(
            "Failed to remove team member:",
            error,
        );

        if (
            error.message.includes("Not authorized") ||
            error.message.includes("Not a team member") ||
            error.message.includes("Only the owner")
        ) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            );
        }

        if (
            error.message.includes("Cannot remove team owner")
        ) {
            return NextResponse.json(
                { error: "Cannot remove team owner" },
                { status: 400 },
            );
        }

        if (
            error.message.includes("Member not found")
        ) {
            return NextResponse.json(
                { error: "Member not found" },
                { status: 404 },
            );
        }

        return NextResponse.json(
            { error: "Failed to remove team member" },
            { status: 500 },
        );
    }

    return NextResponse.json({
        success: true,
    });
}
