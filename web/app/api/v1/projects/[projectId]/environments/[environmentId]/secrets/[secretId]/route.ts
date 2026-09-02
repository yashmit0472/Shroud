import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

type RouteContext = {
    params: Promise<{
        projectId: string;
        environmentId: string;
        secretId: string;
    }>;
};

export async function PATCH(
    request: Request,
    { params }: RouteContext
) {
    const {
        projectId,
        environmentId,
        secretId,
    } = await params;

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

    const {
        data: membership,
        error: membershipError,
    } = await supabase
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

    const {
        data: environment,
        error: environmentError,
    } = await supabase
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
    // LOAD SECRET
    // -----------------------------------------------

    const {
        data: secret,
        error: secretError,
    } = await supabase
        .from("secrets")
        .select(
            "id, key, description, is_required, environment_id, created_at, updated_at"
        )
        .eq("id", secretId)
        .eq("environment_id", environmentId)
        .maybeSingle();

    if (secretError) {
        console.error("Failed to load secret:", {
            message: secretError.message,
            code: secretError.code,
            details: secretError.details,
            hint: secretError.hint,
        });

        return NextResponse.json(
            { error: "Unable to load secret" },
            { status: 500 }
        );
    }

    if (!secret) {
        return NextResponse.json(
            { error: "Secret not found" },
            { status: 404 }
        );
    }

    // -----------------------------------------------
    // PARSE REQUEST
    // -----------------------------------------------

    let body: {
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

    // -----------------------------------------------
    // VALIDATE VALUE
    // -----------------------------------------------

    const hasValue = Object.prototype.hasOwnProperty.call(
        body,
        "value"
    );

    const value =
        typeof body.value === "string"
            ? body.value
            : "";

    if (hasValue && !value) {
        return NextResponse.json(
            { error: "Secret value cannot be empty" },
            { status: 400 }
        );
    }

    const description =
        typeof body.description === "string"
            ? body.description.trim()
            : secret.description;

    const isRequired =
        typeof body.is_required === "boolean"
            ? body.is_required
            : secret.is_required;

    // -----------------------------------------------
    // UPDATE SECRET VALUE
    // -----------------------------------------------

    if (hasValue) {
        const {
            encryptedValue,
            encryptionVersion,
        } = encryptSecret(value);

        const {
            data: newVersion,
            error: versionError,
        } = await supabase.rpc(
            "create_secret_version",
            {
                p_secret_id: secret.id,
                p_encrypted_value: encryptedValue,
                p_encryption_version: encryptionVersion,
                p_created_by: userId,
            }
        );

        if (versionError) {
            console.error("Failed to create secret version:", {
                message: versionError.message,
                code: versionError.code,
                details: versionError.details,
                hint: versionError.hint,
            });

            return NextResponse.json(
                { error: "Unable to create new secret version" },
                { status: 500 }
            );
        }

        // Update metadata at the same time if supplied.
        const {
            data: updatedSecret,
            error: updateError,
        } = await supabase
            .from("secrets")
            .update({
                description,
                is_required: isRequired,
                updated_at: new Date().toISOString(),
            })
            .eq("id", secret.id)
            .select(
                "id, key, description, is_required, environment_id, created_at, updated_at"
            )
            .single();

        if (updateError) {
            console.error("Failed to update secret metadata:", {
                message: updateError.message,
                code: updateError.code,
                details: updateError.details,
                hint: updateError.hint,
            });

            return NextResponse.json(
                {
                    error:
                        "New secret version was created, but metadata could not be updated.",
                },
                { status: 500 }
            );
        }

        return NextResponse.json({
            secret: updatedSecret,
            version: {
                version: newVersion?.version ?? null,
            },
        });
    }

    // -----------------------------------------------
    // UPDATE METADATA ONLY
    // -----------------------------------------------

    const {
        data: updatedSecret,
        error: updateError,
    } = await supabase
        .from("secrets")
        .update({
            description,
            is_required: isRequired,
            updated_at: new Date().toISOString(),
        })
        .eq("id", secret.id)
        .select(
            "id, key, description, is_required, environment_id, created_at, updated_at"
        )
        .single();

    if (updateError) {
        console.error("Failed to update secret metadata:", {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint,
        });

        return NextResponse.json(
            { error: "Unable to update secret" },
            { status: 500 }
        );
    }

    return NextResponse.json({
        secret: updatedSecret,
    });
}
