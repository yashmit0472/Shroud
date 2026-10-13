import { connection } from "next/server";
import { requireWorkspace } from "@/lib/workspace-context";
import { WorkspaceMenu } from "@/components/workspace-menu";

export async function WorkspacePicker() {
  await connection();
  const { workspace, workspaces, userId } = await requireWorkspace();
  return <WorkspaceMenu key={userId + workspace.id} workspaces={workspaces} active={workspace.id} />;
}
