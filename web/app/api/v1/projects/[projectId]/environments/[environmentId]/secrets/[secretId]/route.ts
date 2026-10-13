import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { canManage, canWrite, projectAccess } from "@/lib/workspace-access";

type RouteContext = { params: Promise<{ projectId: string; environmentId: string; secretId: string }> };
export async function PATCH(request: Request, { params }: RouteContext) {
  const { projectId, environmentId, secretId } = await params;
  const access = await projectAccess(projectId, environmentId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this environment" }, { status: access.status });
  if (!canWrite(access.role)) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  const { data: secret, error: secretError } = await access.supabase.from("secrets").select("id,key,description,is_required").eq("id", secretId).eq("environment_id", environmentId).maybeSingle();
  if (secretError) return NextResponse.json({ error: "Unable to load secret" }, { status: 500 });
  if (!secret) return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Expected a JSON object" }, { status: 400 });
  const hasValue = Object.prototype.hasOwnProperty.call(body, "value");
  if ((hasValue && typeof body.value !== "string") || (body.description !== undefined && body.description !== null && typeof body.description !== "string") || (body.is_required !== undefined && typeof body.is_required !== "boolean") || (body.key !== undefined && body.key !== secret.key)) {
    return NextResponse.json({ error: "Invalid secret fields. Key names cannot be changed." }, { status: 400 });
  }
  let encrypted;
  try { encrypted = hasValue ? encryptSecret(body.value) : null; }
  catch { return NextResponse.json({ error: "Secret encryption is unavailable" }, { status: 503 }); }
  const { data, error } = await access.supabase.rpc("shroud_update_secret", {
    p_project_id: projectId, p_environment_id: environmentId, p_secret_id: secretId,
    p_description: body.description === undefined ? secret.description : body.description,
    p_is_required: body.is_required ?? secret.is_required,
    p_encrypted_value: encrypted?.encryptedValue ?? null,
    p_encryption_version: encrypted?.encryptionVersion ?? 1,
    p_update_description: body.description !== undefined,
    p_update_required: body.is_required !== undefined,
  });
  if (error) return NextResponse.json({ error: "Unable to update secret. Check the core database migration." }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json(data);
}
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { projectId, environmentId, secretId } = await params;
  const access = await projectAccess(projectId, environmentId);
  if (access.status !== 200) return NextResponse.json({ error: "Unable to access this environment" }, { status: access.status });
  if (!canManage(access.role)) return NextResponse.json({ error: "Only project owners and admins can delete secrets" }, { status: 403 });
  const { data, error } = await access.supabase.rpc("shroud_delete_secret", { p_project_id: projectId, p_environment_id: environmentId, p_secret_id: secretId });
  if (error) return NextResponse.json({ error: "Unable to delete secret. Check the core database migration." }, { status: error.code === "42501" ? 403 : 500 });
  if (!data) return NextResponse.json({ error: "Secret not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
