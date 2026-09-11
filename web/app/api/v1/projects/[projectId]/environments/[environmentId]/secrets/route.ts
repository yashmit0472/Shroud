import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";
import { encryptSecret } from "@/lib/crypto";

type RouteContext = {
    params: Promise<{
        projectId: string;
        environmentId: string;
    }>;
};

export async function GET(
    request: Request,
    { params }: RouteContext
) {
    const { projectId, environmentId } = await params;

    const authorization = request.headers.get("authorization");

    if (authorization?.startsWith("Bearer ")) {
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
            "list_secrets_for_api_token",
            {
                p_team_id: auth.token.team_id,
                p_project_id: projectId,
                p_environment_id: environmentId,
            },
        );

        if (error) {
            console.error("Failed to list secrets:", error);

            return NextResponse.json(
                { error: "Failed to load secrets" },
                { status: 500 },
            );
        }

        return NextResponse.json({
            secrets: data ?? [],
        });
    }

    const supabase = await createClient();

    // -----------------------------------------------
    // AUTHENTICATION
    // -----------------------------------------------

    const {
        data: claimsData,
        error: claimsError,
    } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims?.sub) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    const userId = claimsData.claims.sub;

    // -----------------------------------------------
    // VERIFY PROJECT MEMBERSHIP
    // -----------------------------------------------

    const { data: membership, error: membershipError } =
        await supabase
            .from("project_members")
            .select("role")
            .eq("project_id", projectId)
            .eq("user_id", userId)
            .maybeSingle();

    if (membershipError) {
        console.error("Failed to verify project membership:", {
            message: membershipError.message,
            code: membershipError.code,
            details: membershipError.details,
            hint: membershipError.hint,
        });

        return NextResponse.json(
            { error: "Unable to verify project access" },
            { status: 500 }
        );
    }

    if (!membership) {
        return NextResponse.json(
            { error: "Forbidden" },
            { status: 403 }
        );
    }

    // -----------------------------------------------
    // VERIFY ENVIRONMENT BELONGS TO PROJECT
    // -----------------------------------------------

    const { data: environment, error: environmentError } =
        await supabase
            .from("environments")
            .select("id, name, slug, type")
            .eq("id", environmentId)
            .eq("project_id", projectId)
            .maybeSingle();

    if (environmentError) {
        console.error("Failed to load environment:", {
            message: environmentError.message,
            code: environmentError.code,
            details: environmentError.details,
            hint: environmentError.hint,
        });

        return NextResponse.json(
            { error: "Unable to load environment" },
            { status: 500 }
        );
    }

    if (!environment) {
        return NextResponse.json(
            { error: "Environment not found" },
            { status: 404 }
        );
    }

    // -----------------------------------------------
    // LOAD SECRET METADATA
    // -----------------------------------------------

    const { data: secrets, error: secretsError } =
        await supabase
            .from("secrets")
            .select(
                "id, key, description, is_required, created_at, updated_at"
            )
            .eq("environment_id", environmentId)
            .order("key", { ascending: true });

    if (secretsError) {
        console.error("Failed to load secrets:", {
            message: secretsError.message,
            code: secretsError.code,
            details: secretsError.details,
            hint: secretsError.hint,
        });

        return NextResponse.json(
            { error: "Unable to load secrets" },
            { status: 500 }
        );
    }

    // IMPORTANT:
    // GET currently returns metadata only.
    // It does NOT return plaintext secret values.

    return NextResponse.json({
        projectId,
        environment: {
            id: environment.id,
            name: environment.name,
            slug: environment.slug,
            type: environment.type,
        },
        secrets: secrets ?? [],
    });
}

export async function POST(
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

    if (!auth.token.scopes.includes("secrets:write")) {
        return NextResponse.json(
            { error: "Insufficient token scope" },
            { status: 403 },
        );
    }

    const body = await request.json();

    const {
        key,
        value,
        description = null,
        is_required = false,
    } = body;

    if (
        typeof key !== "string" ||
        typeof value !== "string" ||
        !key.trim()
    ) {
        return NextResponse.json(
            { error: "key and value are required" },
            { status: 400 },
        );
    }

    const supabase = await createClient();

    const encrypted = encryptSecret(value);

    const { data, error } = await supabase.rpc(
        "create_secret_for_api_token",
        {
            p_team_id: auth.token.team_id,
            p_project_id: projectId,
            p_environment_id: environmentId,
            p_key: key,
            p_description: description ?? null,
            p_is_required: is_required ?? false,
            p_encrypted_value: encrypted.encryptedValue,
            p_encryption_version: encrypted.encryptionVersion,
            p_created_by: auth.token.created_by,
        }
    );

    if (error) {
        console.error("Failed to push secret:", error);

        return NextResponse.json(
            { error: "Failed to push secret" },
            { status: 500 },
        );
    }

    return NextResponse.json(
        {
            secret: data?.[0] ?? null,
        },
        { status: 201 },
    );
}
