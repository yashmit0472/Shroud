import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
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

    let body: {
        token?: string;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const token = body.token?.trim();

    if (!token) {
        return NextResponse.json(
            { error: "Invitation token is required" },
            { status: 400 },
        );
    }

    const { data, error } = await supabase.rpc(
        "accept_team_invitation",
        {
            p_token: token,
            p_user_id: user.id,
        },
    );

    if (error) {
        console.error(
            "Failed to accept invitation:",
            error,
        );

        if (
            error.message.includes(
                "Invalid or expired invitation",
            )
        ) {
            return NextResponse.json(
                { error: "Invalid or expired invitation" },
                { status: 400 },
            );
        }

        return NextResponse.json(
            {
                error: "Failed to accept invitation",
                details: error.message,
            },
            { status: 500 },
        );
    }

    return NextResponse.json({
        team: data?.[0] ?? null,
    });
}
