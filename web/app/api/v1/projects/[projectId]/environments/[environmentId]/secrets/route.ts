import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    { params }: RouteContext
) {
    const { projectId, environmentId } = await params;

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
    // VERIFY ENVIRONMENT
    // -----------------------------------------------

    const { data: environment, error: environmentError } =
        await supabase
            .from("environments")
            .select("id, project_id")
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
    // PARSE REQUEST
    // -----------------------------------------------

    let body: {
        key?: unknown;
        value?: unknown;
        description?: unknown;
        is_required?: unknown;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const key =
        typeof body.key === "string"
            ? body.key.trim()
            : "";

    const value =
        typeof body.value === "string"
            ? body.value
            : "";

    const description =
        typeof body.description === "string"
            ? body.description.trim()
            : null;

    const isRequired =
        typeof body.is_required === "boolean"
            ? body.is_required
            : false;

    if (!key) {
        return NextResponse.json(
            { error: "Secret key is required" },
            { status: 400 }
        );
    }

    if (!value) {
        return NextResponse.json(
            { error: "Secret value is required" },
            { status: 400 }
        );
    }

    // Environment variable style key.
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        return NextResponse.json(
            {
                error:
                    "Secret key must contain only letters, numbers, and underscores, and cannot start with a number.",
            },
            { status: 400 }
        );
    }

    // -----------------------------------------------
    // CHECK FOR EXISTING SECRET
    // -----------------------------------------------

    const { data: existingSecret, error: existingError } =
        await supabase
            .from("secrets")
            .select("id")
            .eq("environment_id", environmentId)
            .eq("key", key)
            .maybeSingle();

    if (existingError) {
        console.error("Failed to check existing secret:", {
            message: existingError.message,
            code: existingError.code,
            details: existingError.details,
            hint: existingError.hint,
        });

        return NextResponse.json(
            { error: "Unable to validate secret" },
            { status: 500 }
        );
    }

    if (existingSecret) {
        return NextResponse.json(
            {
                error:
                    "A secret with this key already exists in this environment.",
            },
            { status: 409 }
        );
    }

    // -----------------------------------------------
    // ENCRYPT SECRET
    // -----------------------------------------------

    const {
        encryptedValue,
        encryptionVersion,
    } = encryptSecret(value);

    // -----------------------------------------------
    // CREATE SECRET METADATA
    // -----------------------------------------------

    const { data: secret, error: secretError } =
        await supabase
            .from("secrets")
            .insert({
                environment_id: environmentId,
                key,
                description,
                is_required: isRequired,
                created_by: userId,
            })
            .select(
                "id, key, description, is_required, created_at, updated_at"
            )
            .single();

    if (secretError) {
        console.error("Failed to create secret:", {
            message: secretError.message,
            code: secretError.code,
            details: secretError.details,
            hint: secretError.hint,
        });

        return NextResponse.json(
            { error: "Unable to create secret" },
            { status: 500 }
        );
    }

    // -----------------------------------------------
    // CREATE FIRST VERSION
    // -----------------------------------------------

    const { error: versionError } =
        await supabase
            .from("secret_versions")
            .insert({
                secret_id: secret.id,
                version: 1,
                encrypted_value: encryptedValue,
                encryption_version: encryptionVersion,
                created_by: userId,
            });

    if (versionError) {
        console.error("Failed to create secret version:", {
            message: versionError.message,
            code: versionError.code,
            details: versionError.details,
            hint: versionError.hint,
        });

        // We created metadata but couldn't create its value.
        // Don't expose the encrypted value or plaintext to the client.
        return NextResponse.json(
            {
                error:
                    "Secret metadata was created, but its initial version could not be stored.",
            },
            { status: 500 }
        );
    }

    // -----------------------------------------------
    // RESPONSE
    // -----------------------------------------------

    return NextResponse.json(
        {
            secret,
        },
        { status: 201 }
    );
}
