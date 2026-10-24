import { connection } from "next/server";
import { requireWorkspace } from "@/lib/workspace-context";
import { canManage, canWrite } from "@/lib/workspace-access";
import { CommandPalette } from "@/components/command-palette";

export async function WorkspaceToolbar() {
  await connection();
  const {supabase,userId,membership}=await requireWorkspace();
  const {data:roles}=await supabase.from("project_members").select("project_id,role").eq("user_id",userId);
  return <CommandPalette manageWorkspace={canManage(membership.role)} createProjects={canWrite(membership.role)} roles={roles??[]}/>;
}
