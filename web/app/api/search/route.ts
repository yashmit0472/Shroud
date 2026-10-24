import { getWorkspaceContext } from "@/lib/workspace-context";
export async function GET(request:Request){
  const context=await getWorkspaceContext();
  if(!context.userId)return Response.json({error:"Sign in to search."},{status:401});
  if(!context.workspace)return Response.json({items:[]});
  const query=new URL(request.url).searchParams.get("q")?.trim().slice(0,200)??"";
  if(query.length<2)return Response.json({items:[]});
  const {data:memberships,error:membershipError}=await context.supabase.from("project_members").select("project_id").eq("user_id",context.userId);
  if(membershipError)return Response.json({error:"Search is unavailable."},{status:503});
  if(!memberships?.length)return Response.json({items:[]});
  const {data:projects,error:projectError}=await context.supabase.from("projects").select("id,name,slug").eq("team_id",context.workspace.id).in("id",memberships.map(entry=>entry.project_id));
  if(projectError)return Response.json({error:"Search is unavailable."},{status:503});
  if(!projects?.length)return Response.json({items:[]});
  const {data:environments,error:environmentError}=await context.supabase.from("environments").select("id,name,project_id,slug").in("project_id",projects.map(project=>project.id));
  if(environmentError)return Response.json({error:"Search is unavailable."},{status:503});
  if(!environments?.length)return Response.json({items:[]});
  // Escape SQL LIKE wildcards. Values and ciphertext are never selected.
  const pattern=query.replace(/[\\%_]/g,"\\$&");
  const {data:secrets,error}=await context.supabase.from("secrets").select("id,key,environment_id").in("environment_id",environments.map(environment=>environment.id)).ilike("key","%"+pattern+"%").order("key").limit(100);
  if(error)return Response.json({error:"Search is unavailable."},{status:503});
  const items=(secrets??[]).map(secret=>{const environment=environments.find(entry=>entry.id===secret.environment_id)!;const project=projects.find(entry=>entry.id===environment.project_id)!;return {...secret,project_id:project.id,project_name:project.name,environment_name:environment.name,environment_slug:environment.slug};});
  return Response.json({items},{headers:{"Cache-Control":"no-store"}});
}
