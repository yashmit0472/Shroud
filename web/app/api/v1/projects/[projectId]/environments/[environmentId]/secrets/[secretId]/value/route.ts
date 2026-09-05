import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";
import { decryptSecret } from "@/lib/crypto";

type RouteContext = {
    params: Promise<{
        projectId: string;
        environmentId: string;
        secretId: string;
    }>;
};

export async function GET(
    request: Request,
    { params }: RouteContext
) {
    const { projectId, environmentId, secretId } = await params;

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
        "get_secret_value_for_api_token",
        {
            p_team_id: auth.token.team_id,
            p_project_id: projectId,
            p_environment_id: environmentId,
            p_secret_id: secretId,
        }
    );

    if (error) {
        console.error("Failed to load secret value:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
        });

        return NextResponse.json(
            { error: "Failed to load secret value" },
            { status: 500 }
        );
    }

    const secret = data?.[0];

    if (!secret) {
        return NextResponse.json(
            { error: "Secret not found" },
            { status: 404 }
        );
    }

    try {
        const value = decryptSecret(secret.encrypted_value);

        return NextResponse.json({
            id: secret.id,
            key: secret.key,
            value,
        });
    } catch (error) {
        console.error("Failed to decrypt secret:", error);

        return NextResponse.json(
            { error: "Failed to decrypt secret" },
            { status: 500 }
        );
    }
}
