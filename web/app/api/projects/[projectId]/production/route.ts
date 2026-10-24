import { projectAccess,canManage } from "@/lib/workspace-access";
import { changeError } from "@/lib/secret-changes";
import { decryptSecret,secretFingerprint } from "@/lib/crypto";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
export async function GET(_request:Request,{params}:{params:Promise<{projectId:string}>}){
 const {projectId}=await params;
 if(!await isActiveWorkspaceProject(projectId))return Response.json({error:"Reopen this project from its workspace."},{status:403});
 const access=await projectAccess(projectId);
 if(access.status!==200)return Response.json({error:"Project access is required."},{status:access.status});
 const [{data:policy,error:policyError},{data:requests,error:requestError}]=await Promise.all([
  access.supabase.from("project_security_settings").select("require_production_approval").eq("project_id",projectId).maybeSingle(),
  access.supabase.rpc("shroud_list_change_requests",{p_project_id:projectId})
 ]);
 if(policyError||requestError)return Response.json({error:"Production settings are unavailable. Apply supabase/install.sql."},{status:503});
 const items=await Promise.all((requests??[]).map(async(row:{id:string;status:string;expires_at:string;changes:{key:string;action:string}[]})=>{
  const request={...row,status:row.status==="pending"&&Date.parse(row.expires_at)<=Date.now()?"expired":row.status};
  if(!canManage(access.role)||request.status!=="pending")return request;
  const {data:values,error}=await access.supabase.rpc("shroud_change_request_ciphertexts",{p_project_id:projectId,p_request_id:row.id});
  if(error)return request;
  return {...request,changes:row.changes.map(change=>{
   const entry=values?.find((value:{key:string})=>value.key===change.key);
   if(!entry)return change;
   try{
    const proposed=entry.proposed_value?secretFingerprint(projectId,change.key,decryptSecret(entry.proposed_value)):null;
    const current=entry.current_value?secretFingerprint(projectId,change.key,decryptSecret(entry.current_value)):null;
    const display=(hash:string|null)=>hash?hash.slice(0,12).match(/.{2}/g)!.join(":").toUpperCase():"—";
    return {...change,current_fingerprint:display(current),proposed_fingerprint:display(proposed)};
   }catch{return {...change,current_fingerprint:"Unreadable",proposed_fingerprint:"Unreadable"};}
  })};
 }));
 return Response.json({require_approval:policy?.require_production_approval??false,requests:items,user_id:access.userId,can_review:canManage(access.role)},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request,{params}:{params:Promise<{projectId:string}>}){
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Invalid request origin."},{status:403});
 const {projectId}=await params,access=await projectAccess(projectId);
 if(access.status!==200)return Response.json({error:"Project access is required."},{status:access.status});
 if(!await isActiveWorkspaceProject(projectId))return Response.json({error:"Reopen this project from its workspace."},{status:403});
 let body;try{body=await request.json();}catch{return Response.json({error:"Invalid request."},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body))return Response.json({error:"Invalid request."},{status:400});
 let result;
 if(body.action==="policy"&&typeof body.require_approval==="boolean"&&body.confirm===true&&canManage(access.role))
  result=await access.supabase.rpc("shroud_set_production_policy",{p_project_id:projectId,p_require_approval:body.require_approval,p_confirm:true});
 else if(body.action==="review"&&typeof body.request_id==="string"&&typeof body.approve==="boolean"){
  // Avoid reviewing a request from another project through this endpoint.
  const {data:requests,error}=await access.supabase.rpc("shroud_list_change_requests",{p_project_id:projectId});
  if(error||!requests?.some((entry:{id:string})=>entry.id===body.request_id))return Response.json({error:"Request not found."},{status:404});
  result=await access.supabase.rpc("shroud_review_change_request",{p_request_id:body.request_id,p_approve:body.approve});
 }else return Response.json({error:"Invalid action or insufficient permissions."},{status:403});
 if(result.error){const problem=changeError(result.error.code);return Response.json({error:problem.error},{status:problem.status});}
 return Response.json({success:true});
}
