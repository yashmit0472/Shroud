import { requireWorkspace,isActiveWorkspaceProject } from "@/lib/workspace-context";
import { projectAccess,canWrite } from "@/lib/workspace-access";
import { changeError } from "@/lib/secret-changes";
export async function GET(){
 const {supabase,workspace}=await requireWorkspace();
 const {data,error}=await supabase.rpc("shroud_rotation_reminders",{p_team_id:workspace.id});
 return error?Response.json({error:"Reminders are unavailable. Apply supabase/install.sql."},{status:503}):Response.json({items:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Invalid request origin."},{status:403});
 let body;try{body=await request.json();}catch{return Response.json({error:"Invalid schedule."},{status:400});}
 if(!body||typeof body.project_id!=="string"||typeof body.secret_id!=="string"||(body.next_rotation_at!==null&&!Number.isFinite(Date.parse(body.next_rotation_at)))||(body.interval_days!==null&&(!Number.isInteger(body.interval_days)||body.interval_days<1||body.interval_days>3650)))return Response.json({error:"Enter a valid date and optional repeat interval (1–3650 days)."},{status:400});
 if(!await isActiveWorkspaceProject(body.project_id))return Response.json({error:"Reopen this project from its workspace."},{status:403});
 const access=await projectAccess(body.project_id);
 if(access.status!==200||!canWrite(access.role))return Response.json({error:"Project write access is required."},{status:403});
 const {data:secret}=await access.supabase.from("secrets").select("id,environments!inner(project_id)").eq("id",body.secret_id).eq("environments.project_id",body.project_id).maybeSingle();
 if(!secret)return Response.json({error:"Secret not found."},{status:404});
 const {error}=await access.supabase.rpc("shroud_set_rotation",{p_secret_id:body.secret_id,p_next_rotation_at:body.next_rotation_at,p_interval_days:body.interval_days});
 if(error){const problem=changeError(error.code);return Response.json({error:problem.error},{status:problem.status});}
 return Response.json({success:true});
}
