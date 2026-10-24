import { projectAccess,canManage } from "@/lib/workspace-access";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { decryptSecret,encryptSecret,secretFingerprint } from "@/lib/crypto";
import { vercelRequest,vercelTargets } from "@/lib/vercel";
import { changeError } from "@/lib/secret-changes";
type Context={params:Promise<{projectId:string}>};
function reply(body:unknown,status=200){return Response.json(body,{status,headers:{"Cache-Control":"no-store","Pragma":"no-cache"}});}
async function accessProject(projectId:string){
 if(!await isActiveWorkspaceProject(projectId))return null;
 const access=await projectAccess(projectId);
 return access.status===200&&canManage(access.role)?access:null;
}
export async function GET(_request:Request,{params}:Context){
 const {projectId}=await params,access=await accessProject(projectId);
 if(!access)return reply({error:"Project owner or admin access is required."},403);
 const {data,error}=await access.supabase.rpc("shroud_vercel_metadata",{p_project_id:projectId});
 return error?reply({error:"Vercel settings are unavailable. Apply supabase/install.sql."},503):reply(data);
}
export async function POST(request:Request,{params}:Context){
 if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Invalid request origin."},403);
 const {projectId}=await params,access=await accessProject(projectId);
 if(!access)return reply({error:"Project owner or admin access is required."},403);
 const raw=await request.text();if(new TextEncoder().encode(raw).length>16384)return reply({error:"Request is too large."},413);
 let body;try{body=JSON.parse(raw);}catch{return reply({error:"Invalid request."},400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"Invalid request."},400);
 try{
  if(body.action==="connect"){
   if(typeof body.project!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(body.project)||typeof body.token!=="string"||!body.token.trim()||body.token.length>4000||(body.team&&(!/^[a-zA-Z0-9_-]{1,100}$/.test(body.team))))return reply({error:"Enter a Vercel project ID, optional team ID, and access token."},400);
   const response=await vercelRequest(body.project,body.team||null,body.token,"GET");
   if(!response.ok)return reply({error:"Vercel rejected the connection. Check the token, project ID, and team scope."},400);
   const {error}=await access.supabase.rpc("shroud_set_vercel_connection",{p_project_id:projectId,p_vercel_project_id:body.project,p_vercel_team_id:body.team||null,p_encrypted_token:encryptSecret(body.token).encryptedValue});
   if(error){const problem=changeError(error.code);return reply({error:problem.error},problem.status);}
   return reply({connected:true});
  }
  if(body.action==="disconnect"){
   const {error}=await access.supabase.rpc("shroud_disconnect_vercel",{p_project_id:projectId});
   return error?reply({error:"Unable to disconnect Vercel."},503):reply({connected:false});
  }
  if(body.action!=="sync"||typeof body.environment_id!=="string"||!vercelTargets.includes(body.target))return reply({error:"Choose a source environment and Vercel target."},400);
  const {data:environment}=await access.supabase.from("environments").select("id,name,type").eq("id",body.environment_id).eq("project_id",projectId).maybeSingle();
  if(!environment)return reply({error:"Environment not found."},404);
  const [{data:connections,error:connectionError},{data:entries,error:readError}]=await Promise.all([
   access.supabase.rpc("shroud_vercel_credentials",{p_project_id:projectId}),
   access.supabase.rpc("shroud_browser_pull",{p_project_id:projectId,p_environment_id:environment.id})
  ]);
  const connection=connections?.[0];
  if(connectionError||!connection||readError)return reply({error:"Connection or secret reads are unavailable. Check configuration and database setup."},503);
  if(!entries?.length)return reply({error:"This source environment has no values to sync."},400);
  const plan=secretFingerprint(projectId,"vercel-sync-plan",JSON.stringify([connection.vercel_project_id,connection.vercel_team_id,connection.encrypted_token,environment.id,body.target,entries]));
  if(body.preview===true)return reply({keys:entries.map((entry:{key:string})=>entry.key),plan,source:environment.name,target:body.target,vercel_project_id:connection.vercel_project_id});
  if(body.confirm_sync!==true||body.plan!==plan)return reply({error:"Configuration changed or the preview was not confirmed. Preview the sync again."},409);
  if((environment.type==="production"||body.target==="production")&&body.confirm_production!==true)return reply({error:"Confirm the Production sync.",code:"P0400"},409);
  const variables=entries.map((entry:{key:string;encrypted_value:string})=>({key:entry.key,value:decryptSecret(entry.encrypted_value),type:"sensitive",visibility:"secret",target:[body.target]}));
  const response=await vercelRequest(connection.vercel_project_id,connection.vercel_team_id,decryptSecret(connection.encrypted_token),"POST",variables);
  if(!response.ok)return reply({error:response.status===429?"Vercel rate limit reached. Retry later.":"Vercel rejected the sync. Check project access and variable policies."},response.status===429?429:502);
  const result=await response.json();
  if(result.failed?.length)return reply({error:"Vercel applied only part of this sync. Review the project before retrying.",partial:true},502);
  const {error:auditError}=await access.supabase.rpc("shroud_record_vercel_sync",{p_project_id:projectId,p_environment_id:environment.id,p_target:body.target,p_count:variables.length});
  return reply({success:true,count:variables.length,target:body.target,audit_pending:!!auditError,notice:"Environment variables synced. Redeploy on Vercel to use the new values."});
 }catch{return reply({error:"Vercel could not be reached or configuration could not be decrypted. Check the connection and existing encryption key."},503);}
}
