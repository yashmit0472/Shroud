import { getWorkspaceContext } from "@/lib/workspace-context";
import { canManage } from "@/lib/roles";
export async function GET(){
 const context=await getWorkspaceContext();
 if(!context.userId)return Response.json({error:"Sign in first."},{status:401});
 if(!context.workspace||!canManage(context.workspace.role))return Response.json({error:"Workspace owner or admin access is required."},{status:403});
 const {data,error}=await context.supabase.rpc("shroud_setup_status",{p_team_id:context.workspace.id});
 return Response.json(error?{ready:false,missing:["Database setup status is unavailable."]}:data,{headers:{"Cache-Control":"no-store"}});
}
