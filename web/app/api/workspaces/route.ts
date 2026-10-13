import { cookies } from "next/headers";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { workspaceCookieName, workspaceCookieOptions } from "@/lib/workspace-selection";

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return reply({ error: "Sign in to view workspaces." }, 401);
  return reply({ workspaces: context.workspaces, active: context.workspace?.id ?? null });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const context = await getWorkspaceContext();
  if (!context.userId) return reply({ error: "Sign in to switch workspaces." }, 401);
  let body;
  try { body = await request.json(); } catch { return reply({ error: "Invalid workspace selection." }, 400); }
  const workspace = context.workspaces.find((item) => item.id === body?.team_id);
  if (!workspace) return reply({ error: "You are not a member of this workspace." }, 403);
  (await cookies()).set(workspaceCookieName, workspace.id, workspaceCookieOptions);
  return reply({ active: workspace.id });
}
