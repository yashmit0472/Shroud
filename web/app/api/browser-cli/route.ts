import { createClient } from "@/lib/supabase/server";
import { projectAccess, canWrite } from "@/lib/workspace-access";
import { decryptSecret } from "@/lib/crypto";
import { getWorkspaceContext, isActiveWorkspaceProject } from "@/lib/workspace-context";
import { applySecretChanges } from "@/lib/secret-changes";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: identity, error } = await supabase.auth.getClaims();
  if (error || !identity?.claims?.sub) return reply({ error: "Sign in to use the terminal.", code: "SESSION_EXPIRED" }, 401);
  const search = new URL(request.url).searchParams;
  const action = search.get("action");
  if (action === "whoami") return reply({ output: `Signed in as ${identity.claims.email ?? identity.claims.sub}` });
  if (action === "teams") {
    const { data, error } = await supabase.from("teams").select("id, name, slug").order("name");
    return error ? reply({ error: "Unable to load teams." }, 500) : reply({ items: data });
  }
  if (action === "projects") {
    const { workspace } = await getWorkspaceContext();
    if (!workspace) return reply({ items: [] });
    const { data: memberships, error } = await supabase.from("project_members").select("project_id").eq("user_id", identity.claims.sub);
    if (error) return reply({ error: "Unable to load project access." }, 500);
    if (!memberships?.length) return reply({ items: [] });
    const { data, error: queryError } = await supabase.from("projects").select("id, name, slug").eq("team_id", workspace.id).in("id", memberships.map((entry) => entry.project_id)).order("name");
    return queryError ? reply({ error: "Unable to load projects." }, 500) : reply({ items: data });
  }
  if (!['environments', 'secrets', 'pull'].includes(action ?? "")) return reply({ error: "Unsupported command." }, 400);
  const projectId = search.get("project") ?? "";
  const environmentId = action === "environments" ? undefined : search.get("environment") ?? "";
  if (!projectId || environmentId === "") return reply({ error: "Choose a project and environment first." }, 400);
  if (!await isActiveWorkspaceProject(projectId)) return reply({ error: "This project is outside your active workspace. Refresh the terminal and choose a project again.", code: "PROJECT_CONTEXT" }, 403);
  const access = await projectAccess(projectId, environmentId);
  if (access.status !== 200) return reply({ error: "You do not have access to this selection.", code: access.status === 403 ? "ACCESS_DENIED" : "READ_UNAVAILABLE" }, access.status);
  if (action === "environments") {
    const { data, error } = await supabase.from("environments").select("id, name, slug, type").eq("project_id", projectId).order("created_at");
    return error ? reply({ error: "Unable to load environments." }, 500) : reply({ items: data });
  }
  const showValues = action === "secrets" && search.get("values") === "true";
  const key = search.get("key") ?? "";
  if (action === "pull" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return reply({ error: "Specify one variable name to pull." }, 400);
  if (action === "secrets" && !showValues) {
    const { data, error } = await supabase.from("secrets").select("key, is_required").eq("environment_id", environmentId!).order("key");
    return error ? reply({ error: "Unable to load secret keys." }, 500) : reply({ items: data });
  }
  const { data, error: pullError } = await supabase.rpc("shroud_browser_pull", { p_project_id: projectId, p_environment_id: environmentId });
  if (pullError) {
    const missing = pullError.code === "PGRST202" || pullError.code === "42883";
    return reply({
      error: missing ? "Secret reads are not configured. Apply 202610130005_restore_secret_reads.sql in Supabase." : pullError.code === "42501" ? "Access denied." : "Secret reads are temporarily unavailable.",
      code: missing ? "READ_SETUP_REQUIRED" : pullError.code === "42501" ? "ACCESS_DENIED" : "READ_UNAVAILABLE",
    }, pullError.code === "42501" ? 403 : 500);
  }
  try {
    const entries = (data ?? []) as { key: string; encrypted_value: string }[];
    const selected = showValues ? entries : entries.filter((entry) => entry.key === key);
    if (!showValues && !selected.length) return reply({ error: "Variable not found in this environment.", code: "SECRET_NOT_FOUND" }, 404);
    const values = selected.map((entry) => ({ key: entry.key, value: decryptSecret(entry.encrypted_value) }));
    return reply({ items: values });
  } catch (failure) {
    const configurationError = failure instanceof Error && (
      failure.message === "SHROUD_ENCRYPTION_KEY is not configured." ||
      failure.message === "SHROUD_ENCRYPTION_KEY must decode to exactly 32 bytes."
    );
    return reply({ error: configurationError ? "Server encryption is not configured." : "Unable to decrypt this stored value.", code: configurationError ? "ENCRYPTION_NOT_CONFIGURED" : "SECRET_UNREADABLE" }, 500);
  }
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return reply({ error: "Sign in to use the terminal." }, 401);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 1048576) return reply({ error: "Variable request must be smaller than 1 MB." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ error: "Invalid variable request." }, 400); }
  if (!body || typeof body.project !== "string" || typeof body.environment !== "string" || typeof body.key !== "string" || typeof body.value !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.key) || body.value.includes("\0")) return reply({ error: "Specify a project, environment, valid variable name, and value." }, 400);
  if (!await isActiveWorkspaceProject(body.project)) return reply({ error: "This project is outside your active workspace. Refresh the terminal and choose a project again." }, 403);
  const access = await projectAccess(body.project, body.environment);
  if (access.status !== 200) return reply({ error: "You do not have access to this selection." }, access.status);
  if (!canWrite(access.role)) return reply({ error: "Your project role cannot write secrets." }, 403);
  const result = await applySecretChanges(body.project,body.environment,[{key:body.key,value:body.value,action:"upsert"}],body.confirm_production===true);
  return reply(result.error?{error:result.error,code:result.code}:{...result.data,key:body.key},result.status);
}
