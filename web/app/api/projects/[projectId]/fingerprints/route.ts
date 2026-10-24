import { projectAccess } from "@/lib/workspace-access";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { decryptSecret,secretFingerprint } from "@/lib/crypto";
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string}>}){
  const {projectId}=await params;
  if(!await isActiveWorkspaceProject(projectId))return Response.json({error:"Select this project's workspace first."},{status:403});
  const access=await projectAccess(projectId);
  if(access.status!==200)return Response.json({error:"Project access is required."},{status:access.status});
  const {data,error}=await access.supabase.rpc("shroud_project_ciphertexts",{p_project_id:projectId});
  if(error)return Response.json({error:"Value comparison is unavailable. Apply supabase/install.sql."},{status:503});
  const groups=new Map<string,string>();
  const entries=(data??[]).map((entry:{secret_id:string;key:string;environment_id:string;encrypted_value:string})=>{
    try{
      const hash=secretFingerprint(projectId,entry.key,decryptSecret(entry.encrypted_value));
      const baseline=groups.get(entry.key);if(!baseline)groups.set(entry.key,hash);
      return {secret_id:entry.secret_id,key:entry.key,environment_id:entry.environment_id,fingerprint:hash.slice(0,12).match(/.{2}/g)!.join(":").toUpperCase(),state:baseline&&baseline!==hash?"different":"matching"};
    }catch{return {secret_id:entry.secret_id,key:entry.key,environment_id:entry.environment_id,fingerprint:null,state:"unreadable"};}
  });
  return Response.json({entries},{headers:{"Cache-Control":"no-store","Pragma":"no-cache"}});
}
