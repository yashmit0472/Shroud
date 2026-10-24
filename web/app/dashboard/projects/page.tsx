import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Plus, Folder, ArrowUpRight, Lock } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace-context";
import { EmptyState, PageSkeleton } from "@/components/empty-state";

async function Projects() {
  await connection();
  const {supabase,userId,workspace,membership}=await requireWorkspace();
  const {data:projects,error}=await supabase.from("projects").select("id,name,description,slug").eq("team_id",workspace.id).order("name");
  const {data:access}=await supabase.from("project_members").select("project_id").eq("user_id",userId);
  const accessible=new Set((access??[]).map(entry=>entry.project_id));
  return <main><div className="page-heading"><div><h1>Projects</h1><p>Environments and configuration in {workspace.name}.</p></div>{membership.role!=="viewer"&&<Link href="/dashboard/projects/new" className="btn-accent"><Plus size={13}/>New project</Link>}</div>
    {error?<p className="inline-error" role="alert">Unable to load projects. Refresh to try again.</p>:projects?.length?<div className="surface-card">{projects.map(project=><div className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0" key={project.id}><Folder size={17} className="text-muted-foreground"/><div className="min-w-0 flex-1">{accessible.has(project.id)?<Link className="text-[13px] font-medium hover:text-primary" href={"/dashboard/projects/"+project.id}>{project.name}</Link>:<span>{project.name}</span>}<p className="mt-1 truncate text-xs text-muted-foreground">{project.description||project.slug}</p></div>{accessible.has(project.id)?<Link className="icon-button" aria-label={"Open "+project.name} href={"/dashboard/projects/"+project.id}><ArrowUpRight size={14}/></Link>:<span className="flex items-center gap-2 text-[10px] text-amber-300"><Lock size={12}/>Access required</span>}</div>)}</div>:<EmptyState title="No projects yet" description="Create your first project to give configuration a home." href={membership.role!=="viewer"?"/dashboard/projects/new":undefined} action="Create project"/>}
  </main>;
}
export default function Page(){return <Suspense fallback={<PageSkeleton/>}><Projects/></Suspense>;}
