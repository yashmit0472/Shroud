import { createClient } from "@/lib/supabase/server";
import { projectAccess, canWrite } from "@/lib/workspace-access";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { getWorkspaceContext, isActiveWorkspaceProject } from "@/lib/workspace-context";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: identity, error } = await supabase.auth.getClaims();
  if (error || !identity?.claims?.sub) return reply({ error: "Sign in to use the terminal." }, 401);
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
  if (!await isActiveWorkspaceProject(projectId)) return reply({ error: "This project is outside your active workspace. Refresh the terminal and choose a project again." }, 403);
  const access = await projectAccess(projectId, environmentId);
  if (access.status !== 200) return reply({ error: "You do not have access to this selection." }, access.status);
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
  if (pullError) return reply({ error: pullError.code === "42501" ? "Access denied." : "Unable to read values. Browser terminal database setup may be pending." }, pullError.code === "42501" ? 403 : 500);
  try {
    const entries = (data ?? []) as { key: string; encrypted_value: string }[];
    const selected = showValues ? entries : entries.filter((entry) => entry.key === key);
    if (!showValues && !selected.length) return reply({ error: "Variable not found in this environment." }, 404);
    const values = selected.map((entry) => ({ key: entry.key, value: decryptSecret(entry.encrypted_value) }));
    return reply({ items: values });
  } catch { return reply({ error: "Unable to decrypt this environment." }, 500); }
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
  try {
    const encrypted = [{ key: body.key, encrypted_value: encryptSecret(body.value).encryptedValue }];
    const { data, error } = await supabase.rpc("shroud_browser_push", { p_project_id: body.project, p_environment_id: body.environment, p_secrets: encrypted });
    if (error) return reply({ error: error.code === "42501" ? "Access denied." : "Unable to save variable. Browser terminal database setup may be pending." }, error.code === "42501" ? 403 : 500);
    return reply({ count: data, key: body.key });
  } catch { return reply({ error: "Unable to encrypt this variable. No values were changed." }, 500); }
}
