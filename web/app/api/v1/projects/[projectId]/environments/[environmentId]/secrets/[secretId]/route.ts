import { NextResponse } from "next/server";
import { isActiveWorkspaceProject } from "@/lib/workspace-context";
import { canManage,canWrite,projectAccess } from "@/lib/workspace-access";
import { applySecretChanges } from "@/lib/secret-changes";
type RouteContext={params:Promise<{projectId:string;environmentId:string;secretId:string}>};
export async function PATCH(request:Request,{params}:RouteContext){
 const {projectId,environmentId,secretId}=await params,access=await projectAccess(projectId,environmentId);
 if(access.status!==200||!canWrite(access.role))return NextResponse.json({error:"Project write access is required."},{status:access.status===200?403:access.status});
 if(!await isActiveWorkspaceProject(projectId))return NextResponse.json({error:"Select this project's workspace first."},{status:403});
 const {data:secret}=await access.supabase.from("secrets").select("id,key").eq("id",secretId).eq("environment_id",environmentId).maybeSingle();
 if(!secret)return NextResponse.json({error:"Secret not found."},{status:404});
 let body;try{body=await request.json();}catch{return NextResponse.json({error:"Invalid JSON body."},{status:400});}
 const hasValue=Object.prototype.hasOwnProperty.call(body??{},"value");
 if(!body||(hasValue&&(typeof body.value!=="string"||body.value.includes("\0")))||(body.description!==undefined&&body.description!==null&&typeof body.description!=="string")||(body.is_required!==undefined&&typeof body.is_required!=="boolean")||(body.key!==undefined&&body.key!==secret.key))return NextResponse.json({error:"Invalid fields. Key names cannot be changed."},{status:400});
 const result=await applySecretChanges(projectId,environmentId,[{key:secret.key,secret_id:secretId,action:hasValue?"upsert":"metadata",...(hasValue?{value:body.value}:{}),...(body.description!==undefined?{description:body.description}:{}),...(body.is_required!==undefined?{is_required:body.is_required}:{})}],body.confirm_production===true);
 return NextResponse.json(result.error?{error:result.error,code:result.code}:result.data,{status:result.status});
}
export async function DELETE(request:Request,{params}:RouteContext){
 const {projectId,environmentId,secretId}=await params,access=await projectAccess(projectId,environmentId);
 if(access.status!==200||!canManage(access.role))return NextResponse.json({error:"Project owner or admin access is required."},{status:access.status===200?403:access.status});
 if(!await isActiveWorkspaceProject(projectId))return NextResponse.json({error:"Select this project's workspace first."},{status:403});
 const {data:secret}=await access.supabase.from("secrets").select("id,key").eq("id",secretId).eq("environment_id",environmentId).maybeSingle();
 if(!secret)return NextResponse.json({error:"Secret not found."},{status:404});
 let body;try{body=await request.json();}catch{body={};}
 const result=await applySecretChanges(projectId,environmentId,[{key:secret.key,secret_id:secretId,action:"delete"}],body.confirm_production===true);
 if(result.error)return NextResponse.json({error:result.error,code:result.code},{status:result.status});
 return result.data?.pending?NextResponse.json(result.data,{status:202}):new NextResponse(null,{status:204});
}
