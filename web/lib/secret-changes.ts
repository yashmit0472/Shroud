import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

export type SecretChange = { key:string; value?:string; description?:string|null; is_required?:boolean; action?:"create"|"upsert"|"metadata"|"delete"; secret_id?:string };
export function changeError(code?:string) {
  switch(code){
    case "P0400": return {error:"Confirm the Production change. If approvals are enabled, a different project owner or admin must review it.",status:409};
    case "P0409": return {error:"This request is stale or no longer pending. Refresh and create a new request.",status:409};
    case "23505": return {error:"A variable with this key already exists.",status:409};
    case "42501": return {error:"You do not have permission to make this change.",status:403};
    case "P0404": return {error:"The variable no longer exists.",status:404};
    case "PGRST202": case "42P01": return {error:"Database setup is incomplete. Apply supabase/install.sql.",status:503};
    case "P0429": return {error:"Too many requests. Retry in a minute.",status:429};
    default: return {error:"The change could not be saved. No values were changed.",status:500};
  }
}
export async function applySecretChanges(projectId:string,environmentId:string,changes:SecretChange[],confirmed:boolean,tokenHash?:string) {
  let entries;
  try { entries=changes.map(({value,...metadata})=>({...metadata,...(value!==undefined?{encrypted_value:encryptSecret(value).encryptedValue}:{})})); }
  catch { return {data:null,code:"ENCRYPTION_NOT_CONFIGURED",error:"Secret encryption is unavailable. Check the existing server encryption key.",status:503}; }
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("shroud_apply_secret_changes",{p_project_id:projectId,p_environment_id:environmentId,p_entries:entries,p_confirm_production:confirmed,p_token_hash:tokenHash??null});
  if(error){const problem=changeError(error.code);return {data:null,code:error.code,...problem};}
  return {data,error:null,status:data?.pending?202:200};
}
