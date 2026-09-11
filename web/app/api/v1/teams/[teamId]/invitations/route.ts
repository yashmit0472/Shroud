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
        "list_team_invitations",
        {
            p_team_id: teamId,
            p_user_id: user.id,
        },
    );

    if (error) {
        console.error(
            "Failed to load invitations:",
            error,
        );

        if (error.message.includes("Not authorized")) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Failed to load invitations" },
            { status: 500 },
        );
    }

    return NextResponse.json({
        invitations: data ?? [],
    });
}

export async function POST(
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

    let body: {
        role?: "admin" | "developer" | "viewer";
        expires_in_days?: number;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 },
        );
    }

    const role = body.role ?? "developer";

    if (!["admin", "developer", "viewer"].includes(role)) {
        return NextResponse.json(
            { error: "Invalid team role" },
            { status: 400 },
        );
    }

    const expiresInDays = Math.min(
        Math.max(body.expires_in_days ?? 7, 1),
        30,
    );

    const expiresAt = new Date(
        Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await supabase.rpc(
        "create_team_invitation",
        {
            p_team_id: teamId,
            p_invited_by: user.id,
            p_role: role,
            p_expires_at: expiresAt,
        },
    );

    if (error) {
        console.error(
            "Failed to create invitation:",
            error,
        );

        if (
            error.message.includes("Not authorized")
        ) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 },
            );
        }

        return NextResponse.json(
            { error: "Failed to create invitation" },
            { status: 500 },
        );
    }

    const invitation = data?.[0];

    if (!invitation) {
        return NextResponse.json(
            { error: "Failed to create invitation" },
            { status: 500 },
        );
    }

    return NextResponse.json(
        {
            invitation: {
                id: invitation.id,
                team_id: invitation.team_id,
                role: invitation.role,
                token: invitation.token,
                invite_code: invitation.invite_code,
                expires_at: invitation.expires_at,
            },
        },
        { status: 201 },
    );
}
