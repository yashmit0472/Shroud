import { connection } from "next/server";
import { requireWorkspace } from "@/lib/workspace-context";

export async function SidebarProfile() {
  await connection();
  const { supabase, userId, membership } = await requireWorkspace();
  const { data:profile } = await supabase.from("profiles").select("full_name").eq("id",userId).maybeSingle();
  const name = profile?.full_name || "Your account";
  return <div className="sidebar-person"><span className="avatar">{name.split(" ").map((part:string) => part[0]).slice(0,2).join("").toUpperCase()}</span><div className="min-w-0"><p className="truncate text-[11px]">{name}</p><p className="text-[10px] capitalize text-muted-foreground">{membership.role}</p></div></div>;
}
