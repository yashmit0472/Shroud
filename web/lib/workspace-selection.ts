export const workspaceCookieName = "shroud_workspace";
export const workspaceCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
export type WorkspaceRole = "owner" | "admin" | "developer" | "viewer";
export type Workspace = { id: string; name: string; slug: string; role: WorkspaceRole };

export function selectWorkspace(workspaces: Workspace[], requestedId?: string) {
  return workspaces.find((workspace) => workspace.id === requestedId) ?? workspaces[0] ?? null;
}
