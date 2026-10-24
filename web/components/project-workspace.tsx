"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Folder, Plus } from "lucide-react";
import Link from "next/link";
import { SecretExplorer,SecretMetadata } from "@/components/secret-explorer";
import { EnvironmentMatrix } from "@/components/environment-matrix";
import { PromotionDialog } from "@/components/promotion-dialog";
import { AuditViewer } from "@/components/audit-viewer";
import { canWrite,canManage } from "@/lib/roles";
import { BulkEnvDialog } from "@/components/bulk-env-dialog";
import { ProductionControls } from "@/components/production-controls";
import { VercelIntegration } from "@/components/vercel-integration";
import { useFingerprints } from "@/components/use-fingerprints";

type Environment={id:string;name:string;type:string;slug:string};
export function ProjectWorkspace({project,environments,secrets,required,role,initialEnvironment,access,settings}:{project:{id:string;name:string;description:string|null;team_id:string};environments:Environment[];secrets:SecretMetadata[];required:string[];role:string;initialEnvironment?:string;access:React.ReactNode;settings:React.ReactNode}){
  const router=useRouter();
  const search=useSearchParams();
  const tab=["secrets","compare","activity","access","settings"].includes(search.get("tab")??"")?search.get("tab")!:"secrets";
  const environment=environments.find(item=>item.id===search.get("env")||item.slug===search.get("env")||item.type===search.get("env"))||environments.find(item=>item.id===initialEnvironment)||environments.find(item=>item.type==="development")||environments[0];
  const [promotion,setPromotion]=useState<{secret:SecretMetadata;target?:string}|null>(null);
  const [bulk,setBulk]=useState<"import"|"export"|null>(null);
  const fingerprints=useFingerprints(project.id,secrets.map(secret=>secret.id+secret.updated_at).join("|"));
  const base="/dashboard/projects/"+project.id;
  function navigate(nextTab:string,env?:Environment,secret?:string){
    const params=new URLSearchParams({tab:nextTab});
    if(env)params.set("env",env.slug);else if(environment)params.set("env",environment.slug);
    if(secret)params.set("secret",secret);
    router.push(base+"?"+params,{scroll:false});
  }
  const currentSecrets=secrets.filter(secret=>secret.environment_id===environment?.id);
  return <main><div className={"project-frame "+(environment?.type==="production"?"production-context":"")}>
    <div className="project-heading"><p className="mb-3 flex items-center gap-2 text-[10px]"><Link href="/dashboard/projects" className="hover:text-foreground">Projects</Link><span>/</span>{project.name}</p><div className="flex items-start gap-3"><span className="stat-icon"><Folder size={17}/></span><div><h1>{project.name}</h1><p>{project.description||"Project configuration and environment secrets."}</p></div></div>
      <div className="project-tabs" role="tablist" aria-label="Project views">{["secrets","compare","activity","access","settings"].map(item=><button type="button" role="tab" aria-selected={tab===item} key={item} onClick={()=>navigate(item)}>{item[0].toUpperCase()+item.slice(1)}</button>)}</div>
    </div>
    <div className="project-body" key={(environment?.id??"")+"-"+tab}>
      {["secrets","compare"].includes(tab)&&<div className="env-switcher">{environments.map(item=><button type="button" key={item.id} aria-pressed={environment?.id===item.id} className={"env-context "+item.type} onClick={()=>navigate("secrets",item)} onDragOver={event=>{if(canWrite(role))event.preventDefault();}} onDrop={event=>{event.preventDefault();const secret=secrets.find(secret=>secret.id===event.dataTransfer.getData("application/x-shroud-secret"));if(canWrite(role)&&secret&&secret.environment_id!==item.id)setPromotion({secret,target:item.id});}}><i className={"dot "+item.type}/>{item.name}<small>({secrets.filter(secret=>secret.environment_id===item.id).length})</small></button>)}</div>}
      {tab==="secrets"&&environment&&<div className="mb-3 flex justify-end gap-2">{canWrite(role)&&<button type="button" className="btn-outline" onClick={()=>setBulk("import")}>Import .env text</button>}<button type="button" className="btn-outline" onClick={()=>setBulk("export")}>Export .env</button></div>}
      {tab==="secrets"&&(environment?<SecretExplorer key={environment.id+"-"+(search.get("secret")??"")} fingerprints={fingerprints.entries} projectId={project.id} environment={environment} secrets={currentSecrets} role={role} initialSecret={search.get("secret")??undefined} onPromote={secret=>setPromotion({secret})} onRefresh={()=>router.refresh()}/>:<div className="empty-state"><strong>No environments</strong><p>This project has no environments yet.</p></div>)}
      {tab==="secrets"&&search.get("add")==="1"&&environment&&canWrite(role)&&<Link href={base+"/environments/"+environment.id+"/secrets/new"} className="btn-accent mt-4"><Plus size={12}/>Create a new secret</Link>}
      {tab==="compare"&&<EnvironmentMatrix environments={environments} secrets={secrets} required={[...new Set([...required,...secrets.filter(secret=>secret.is_required).map(secret=>secret.key)])]} fingerprints={fingerprints.entries} available={fingerprints.available} onSelect={(id,secret)=>navigate("secrets",environments.find(item=>item.id===id),secret)}/>}
      {tab==="activity"&&<div className="space-y-5"><ProductionControls projectId={project.id} mode="requests"/><AuditViewer teamId={project.team_id} projectId={project.id}/></div>}
      {tab==="access"&&access}
      {tab==="settings"&&<div className="space-y-5"><ProductionControls projectId={project.id} mode="settings"/><VercelIntegration projectId={project.id} environments={environments} canManage={canManage(role)}/>{settings}</div>}
    </div>
  </div>{bulk&&environment&&<BulkEnvDialog key={environment.id+bulk} projectId={project.id} environment={environment} mode={bulk} onClose={()=>setBulk(null)}/>}{promotion&&<PromotionDialog projectId={project.id} secretKey={promotion.secret.key} source={environments.find(item=>item.id===promotion.secret.environment_id)!} environments={environments} initialTarget={promotion.target} onClose={()=>setPromotion(null)}/>}</main>;
}
