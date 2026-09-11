import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";
import { decryptSecret } from "@/lib/crypto";

type RouteContext = {
    params: Promise<{
        projectId: string;
        environmentId: string;
    }>;
};

export async function GET(
    request: Request,
    { params }: RouteContext,
) {
    const { projectId, environmentId } = await params;

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
        "get_all_secret_values_for_api_token",
        {
            p_team_id: auth.token.team_id,
            p_project_id: projectId,
            p_environment_id: environmentId,
        },
    );

    if (error) {
        console.error(
            "Failed to load secret values:",
            error,
        );

        return NextResponse.json(
            { error: "Failed to load secret values" },
            { status: 500 },
        );
    }

    try {
        const secrets = (data ?? []).map((secret: { id: string; key: string; encrypted_value: string }) => ({
            id: secret.id,
            key: secret.key,
            value: decryptSecret(secret.encrypted_value),
        }));

        return NextResponse.json({
            secrets,
        });
    } catch (error) {
        console.error(
            "Failed to decrypt secret values:",
            error,
        );

        return NextResponse.json(
            { error: "Failed to decrypt secret values" },
            { status: 500 },
        );
    }
}
