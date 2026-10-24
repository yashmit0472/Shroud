import { connection } from "next/server";
import Link from "next/link";
import { Folder, KeyRound, Users, Plus, ArrowUpRight } from "lucide-react";
import { requireWorkspace } from "@/lib/workspace-context";
import { canManage } from "@/lib/workspace-access";
import { ProjectHealthRow } from "@/components/project-health-row";
import { EmptyState } from "@/components/empty-state";

export default async function DashboardContent() {
  await connection();
  const { supabase, userId, workspace:team, membership } = await requireWorkspace();
  const { data:projects, error:projectsError } = await supabase.from("projects").select("id,name,slug,description,created_at").eq("team_id",team.id).order("created_at",{ascending:false});
  if (projectsError) return <main><div className="inline-error" role="alert">Projects could not be loaded. Refresh to try again.</div></main>;
  const { data:access, error:accessError } = projects?.length ? await supabase.from("project_members").select("project_id").eq("user_id",userId).in("project_id",projects.map(project => project.id)) : {data:[],error:null};
  const accessible = new Set((access ?? []).map(item => item.project_id));
  const projectIds = [...accessible];
  const [{data:environments,error:environmentError},{data:required,error:requiredError},{data:profile},{count:members},{count:tokens,error:tokenError},{data:events}] = await Promise.all([
    projectIds.length ? supabase.from("environments").select("id,name,type,project_id").in("project_id",projectIds) : Promise.resolve({data:[],error:null}),
    projectIds.length ? supabase.from("required_keys").select("project_id,key").in("project_id",projectIds) : Promise.resolve({data:[],error:null}),
    supabase.from("profiles").select("full_name").eq("id",userId).maybeSingle(),
    supabase.from("team_members").select("id",{count:"exact",head:true}).eq("team_id",team.id),
    canManage(membership.role) ? supabase.from("api_tokens").select("id",{count:"exact",head:true}).eq("team_id",team.id).is("revoked_at",null).or("expires_at.is.null,expires_at.gt." + new Date().toISOString()) : Promise.resolve({count:null,error:null}),
    supabase.from("audit_logs").select("id,action,created_at,project_id,environment_id,actor_id").eq("team_id",team.id).order("created_at",{ascending:false}).limit(5),
  ]);
  const envIds=(environments??[]).map(environment=>environment.id);
  const {data:secrets,error:secretsError}=envIds.length ? await supabase.from("secrets").select("environment_id,key,is_required").in("environment_id",envIds) : {data:[],error:null};
  const failed=!!(environmentError||requiredError||secretsError||accessError);
  const missing = (projects??[]).flatMap(project => {
    const envs=(environments??[]).filter(environment=>environment.project_id===project.id);
    const keys=new Set([...(secrets??[]).filter(secret=>envs.some(environment=>environment.id===secret.environment_id)).map(secret=>secret.key),...(required??[]).filter(key=>key.project_id===project.id).map(key=>key.key)]);
    return envs.map(environment=>[...keys].filter(key=>!(secrets??[]).some(secret=>secret.environment_id===environment.id&&secret.key===key)).length);
  }).reduce((sum,n)=>sum+n,0);
  return <main className="dashboard-page">
    <div className="page-heading"><div><p className="eyebrow">{team.name}</p><h1 className="mt-2">Welcome back{profile?.full_name ? ", " + profile.full_name.split(" ")[0] : ""}.</h1><p>{failed ? "Some configuration checks are unavailable." : missing ? missing + " missing configuration entries need attention." : projects?.length ? "Your accessible projects have no missing configuration keys." : "Create your first project to get started."}</p></div>{membership.role!=="viewer"&&<Link href="/dashboard/projects/new" className="btn-accent"><Plus size={13} />New project</Link>}</div>
    <div className="stat-strip">{[{icon:Folder,value:projects?.length??0,label:"Projects"},{icon:KeyRound,value:secretsError?"—":secrets?.length??0,label:"Accessible secrets"},{icon:Users,value:members??"—",label:"Members"},{icon:KeyRound,value:tokenError?"—":tokens??"—",label:"Active tokens"}].map(({icon:Icon,value,label})=><div className="stat-item" key={label}><span className="stat-icon"><Icon size={14}/></span><div><strong>{value}</strong><p>{label}</p></div></div>)}</div>
    <div className="section-label" id="projects"><span>Configuration health</span><Link className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground" href="/dashboard/projects">All projects<ArrowUpRight size={12}/></Link></div>
    {projects?.length ? projects.map(project=>{
      const envs=(environments??[]).filter(environment=>environment.project_id===project.id);
      const keys=new Set([...(secrets??[]).filter(secret=>envs.some(environment=>environment.id===secret.environment_id)).map(secret=>secret.key),...(required??[]).filter(key=>key.project_id===project.id).map(key=>key.key)]);
      return <ProjectHealthRow key={project.id} project={project} accessible={accessible.has(project.id)} environments={failed?null:envs.map(environment=>{const present=(secrets??[]).filter(secret=>secret.environment_id===environment.id).length;return {...environment,present,total:keys.size,missing:Math.max(0,keys.size-present)};})}/>;
    }) : <EmptyState title="No projects yet" description="Create a project to organize your environments and secrets." href={membership.role!=="viewer"?"/dashboard/projects/new":undefined} action="Create project"/>}
    <div className="section-label"><span>Recent activity</span><Link href="/dashboard/audit" className="text-[11px] text-muted-foreground hover:text-foreground">View audit logs →</Link></div>
    {events?.length ? <div className="surface-card px-4">{events.map(event=><Link className="audit-row" href="/dashboard/audit" key={event.id}><time className="audit-time">{new Date(event.created_at).toISOString().slice(11,16)}</time><span className="avatar">{event.actor_id===userId?profile?.full_name?.[0]??"Y":event.actor_id?"M":"S"}</span><span>{event.action.replaceAll("."," · ").replaceAll("_"," ")}</span><span className="audit-scope">{projects?.find(project=>project.id===event.project_id)?.name??"Workspace"}{event.environment_id?" / "+(environments??[]).find(environment=>environment.id===event.environment_id)?.name:""}</span></Link>)}</div> : <EmptyState title="No recent activity" description="Workspace changes and secret access will appear here."/>}
  </main>;
}
