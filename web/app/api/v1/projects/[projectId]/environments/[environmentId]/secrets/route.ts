import { NextResponse } from "next/server";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/server";
import { authenticateApiToken } from "@/lib/api-auth";
import { applySecretChanges } from "@/lib/secret-changes";
import { canWrite, projectAccess } from "@/lib/workspace-access";

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
            p_token_hash: auth.token.hash,
                p_project_id: projectId,
                p_environment_id: environmentId,
            },
        );

        if (error) {
        if (error.code === "P0429") return NextResponse.json({ error: "Token rate limit exceeded" }, { status: 429, headers: { "Retry-After": "60" } });
        if (error.code === "42501") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

export async function POST(request:Request,{params}:RouteContext){
  const {projectId,environmentId}=await params;
  const isToken=request.headers.get("authorization")?.startsWith("Bearer ");
  const auth=isToken?await authenticateApiToken(request):null;
  const access=!isToken?await projectAccess(projectId,environmentId):null;
  if(auth&&!auth.token)return NextResponse.json({error:"Invalid API token."},{status:401});
  if(auth?.token&&!auth.token.scopes.includes("secrets:write"))return NextResponse.json({error:"Write scope is required."},{status:403});
  if(!isToken&&!await isActiveWorkspaceProject(projectId))return NextResponse.json({error:"Select this project's workspace first."},{status:403});
  if(access&&(access.status!==200||!canWrite(access.role)))return NextResponse.json({error:"Project write access is required."},{status:access.status===200?403:access.status});
  let body;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body."},{status:400});}
  if(!body||typeof body.key!=="string"||typeof body.value!=="string"||body.value.includes("\0")||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.key)||(body.description!==undefined&&body.description!==null&&typeof body.description!=="string")||(body.is_required!==undefined&&typeof body.is_required!=="boolean"))return NextResponse.json({error:"Enter a valid key, value, and metadata."},{status:400});
  const result=await applySecretChanges(projectId,environmentId,[{key:body.key,value:body.value,action:auth?.token?"upsert":"create",...(body.description!==undefined?{description:body.description}:{}),...(body.is_required!==undefined?{is_required:body.is_required}:{})}],body.confirm_production===true,auth?.token?.hash);
  if(result.error)return NextResponse.json({error:result.error,code:result.code},{status:result.status});
  return NextResponse.json(result.data?.pending?result.data:{secret:{...result.data?.changes?.[0],description:body.description??null,is_required:body.is_required??false},pending:false},{status:result.data?.pending?202:201});
}
