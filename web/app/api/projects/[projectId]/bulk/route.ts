import { projectAccess,canWrite } from "@/lib/workspace-access";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { previewEnvImport } from "@/lib/bulk-env";
import { applySecretChanges } from "@/lib/secret-changes";
import { decryptSecret,secretFingerprint } from "@/lib/crypto";
import { serializeBrowserEnv } from "@/lib/browser-cli";
type Context={params:Promise<{projectId:string}>};
export async function POST(request:Request,{params}:Context){
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Invalid request origin."},{status:403});
  const {projectId}=await params;
  const raw=await request.text();
  if(new TextEncoder().encode(raw).length>1048576)return Response.json({error:"Input must be smaller than 1 MB."},{status:413});
  let body;try{body=JSON.parse(raw);}catch{return Response.json({error:"Invalid import request."},{status:400});}
  if(!body||typeof body.environment_id!=="string"||typeof body.content!=="string")return Response.json({error:"Choose an environment and paste .env text."},{status:400});
  if(!await isActiveWorkspaceProject(projectId))return Response.json({error:"Select this project's workspace first."},{status:403});
  const access=await projectAccess(projectId,body.environment_id);
  if(access.status!==200||!canWrite(access.role))return Response.json({error:"Write access is required."},{status:access.status===200?403:access.status});
  const {data:existing,error}=await access.supabase.from("secrets").select("id,key,description,is_required,updated_at").eq("environment_id",body.environment_id);
  if(error)return Response.json({error:"Unable to load existing keys."},{status:503});
  let entries;try{entries=previewEnvImport(body.content,(existing??[]).map(entry=>entry.key));}catch(failure){return Response.json({error:failure instanceof Error?failure.message:"Invalid .env text."},{status:400});}
  const {data:versions,error:versionError}=await access.supabase.rpc("shroud_project_ciphertexts",{p_project_id:projectId});
  if(versionError)return Response.json({error:"Import preview is unavailable. Apply supabase/install.sql."},{status:503});
  let plan;try{plan=secretFingerprint(projectId,"bulk-import-plan",JSON.stringify([body.environment_id,body.content,entries.map(({key})=>({key,metadata:existing?.find(entry=>entry.key===key)??null,version:versions?.find((entry:{key:string;environment_id:string})=>entry.key===key&&entry.environment_id===body.environment_id)?.encrypted_value??null}))]));}catch{return Response.json({error:"Encryption configuration is unavailable."},{status:503});}
  if(body.preview===true)return Response.json({changes:entries.map(({key,action})=>({key,action})),count:entries.length,plan},{headers:{"Cache-Control":"no-store"}});
  if(body.confirm_import!==true)return Response.json({error:"Review and confirm the import first."},{status:409});
  if(body.plan!==plan)return Response.json({error:"Values or metadata changed since your preview. Preview the import again."},{status:409});
  const result=await applySecretChanges(projectId,body.environment_id,entries.map(({key,value})=>({key,value,action:"upsert"})),body.confirm_production===true);
  return Response.json(result.error?{error:result.error,code:result.code}:result.data,{status:result.status,headers:{"Cache-Control":"no-store"}});
}
export async function GET(request:Request,{params}:Context){
  const {projectId}=await params,search=new URL(request.url).searchParams,environmentId=search.get("environment_id")??"";
  if(search.get("confirm_export")!=="true")return Response.json({error:"Confirm exporting plaintext values first."},{status:409});
  if(!await isActiveWorkspaceProject(projectId))return Response.json({error:"Select this project's workspace first."},{status:403});
  const access=await projectAccess(projectId,environmentId);
  if(access.status!==200)return Response.json({error:"Unable to access this environment."},{status:access.status});
  const {data,error}=await access.supabase.rpc("shroud_browser_pull",{p_project_id:projectId,p_environment_id:environmentId});
  if(error)return Response.json({error:"Secret export is unavailable. Check database setup."},{status:503});
  try{
    const content=serializeBrowserEnv((data??[]).map((entry:{key:string;encrypted_value:string})=>({key:entry.key,value:decryptSecret(entry.encrypted_value)})));
    return new Response(content,{headers:{"Content-Type":"text/plain; charset=utf-8","Content-Disposition":'attachment; filename="shroud.env"',"Cache-Control":"no-store","Pragma":"no-cache","X-Content-Type-Options":"nosniff"}});
  }catch{return Response.json({error:"Export could not be decrypted. Check the existing encryption key."},{status:503});}
}
