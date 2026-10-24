"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileKey2, Search, X, Lock, History, Pencil, Plus, ArrowUpRight } from "lucide-react";
import { SecretReveal } from "@/components/secret-reveal";
import { Dialog } from "@/components/dialog";
import { RotationEditor } from "@/components/rotation-editor";
import { useSecretMutation } from "@/components/use-secret-mutation";
import { Fingerprint } from "@/components/use-fingerprints";
import { createClient } from "@/lib/supabase/client";
import { canManage,canWrite } from "@/lib/roles";

export type SecretMetadata={id:string;key:string;environment_id:string;description:string|null;is_required:boolean;updated_at:string;created_at:string;created_by?:string|null};
type Version={id:string;version:number;created_at:string;created_by:string|null};
function InspectorHistory({projectId,environmentId,secretId}:{projectId:string;environmentId:string;secretId:string}){
  const [versions,setVersions]=useState<Version[]>([]);
  const [pending,setPending]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    let active=true;
    createClient().rpc("shroud_secret_history",{p_project_id:projectId,p_environment_id:environmentId,p_secret_id:secretId}).then(({data,error})=>{
      if(!active)return;
      if(error)setError("History could not be loaded. Try again.");
      else setVersions(data??[]);
      setPending(false);
    });
    return()=>{active=false;};
  },[projectId,environmentId,secretId]);
  return <div className="mt-4">{error?<p className="inline-error" role="alert">{error}</p>:pending?<div className="skeleton w-full"/>:versions.length?versions.map(version=><div className="border-b border-border py-3 text-xs" key={version.id}><p>Version {version.version}</p><p className="mt-1 text-[10px] text-muted-foreground">{new Date(version.created_at).toISOString().replace("T"," ").slice(0,16)} UTC</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Updated by: {version.created_by??"Unknown"}</p></div>):<p className="text-xs text-muted-foreground">No versions available.</p>}</div>;
}
export function SecretExplorer({projectId,environment,secrets,role,fingerprints,initialSecret,onPromote,onRefresh}:{projectId:string;environment:{id:string;name:string;type:string};secrets:SecretMetadata[];role:string;fingerprints:Fingerprint[];initialSecret?:string;onPromote:(secret:SecretMetadata)=>void;onRefresh:()=>void}){
  const mutation=useSecretMutation();
  const [notice,setNotice]=useState("");
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState(initialSecret??"");
  const [tab,setTab]=useState("details");
  const [remove,setRemove]=useState(false);
  const [confirmation,setConfirmation]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const panel=useRef<HTMLElement>(null);
  const secret=secrets.find(item=>item.id===selected);
  const results=secrets.filter(item=>item.key.toLowerCase().includes(query.toLowerCase()));
  const base="/dashboard/projects/"+projectId+"/environments/"+environment.id;
  useEffect(()=>{if(selected)panel.current?.focus();},[selected]);
  async function deleteSecret(){
    if(!secret||confirmation!==secret.key)return;
    setBusy(true);setError("");
    try{
      const response=await mutation.request(base+"/secrets/"+secret.id,{method:"DELETE"});
      if(!response.ok)throw new Error();
      setRemove(false);setConfirmation("");
      if(response.status===202)setNotice("Production deletion is awaiting approval in Activity.");else setSelected("");
      onRefresh();
    }catch{setError("Secret could not be deleted. Check your permissions and try again.");}
    finally{setBusy(false);}
  }
  return <>{mutation.confirmation}{notice&&<p role="status" className="mb-3 text-xs text-primary">{notice}</p>}
    <div className="explorer-toolbar"><label className="search-field min-w-0 flex-1"><Search size={13}/><input aria-label="Search secrets" placeholder="Search secrets…" value={query} onChange={event=>setQuery(event.target.value)}/></label>{canWrite(role)&&<Link className="btn-outline" href={base+"/secrets/new"}><Plus size={13}/>Add secret</Link>}</div>
    <div className={"secret-workbench"+(!secret?" no-inspector":"")}><div className="min-w-0">
      <div className="explorer-head"><span>Key</span><span>Fingerprint</span><span>Updated · UTC</span></div>
      {results.length?results.map(item=><button type="button" key={item.id} className="secret-row" aria-pressed={selected===item.id} draggable={canWrite(role)} onDragStart={event=>event.dataTransfer.setData("application/x-shroud-secret",item.id)} onClick={()=>{setSelected(item.id);setTab("details");}}><span className="secret-key"><FileKey2 size={13} className="shrink-0 text-muted-foreground"/><span>{item.key}</span>{item.is_required&&<span className="ml-auto text-[9px] text-muted-foreground">required</span>}</span><span className="flex items-center gap-1 text-[10px] text-muted-foreground">{fingerprints.find(entry=>entry.secret_id===item.id)?.fingerprint??<><Lock size={10}/>Protected</>}</span><time className="text-[10px] text-muted-foreground">{new Date(item.updated_at).toISOString().slice(0,10)}</time></button>):<div className="empty-state m-3"><strong>{query?"No matching secrets":"No secrets yet"}</strong><p>{query?"Try a different key name.":"Add your first variable to this environment."}</p></div>}
      <p className="px-3 py-4 text-[10px] text-muted-foreground">{secrets.length} keys · Values hidden by default</p>
    </div>
    {secret&&<aside key={secret.id} ref={panel} tabIndex={-1} className="secret-inspector" aria-label={secret.key+" inspector"} onKeyDown={event=>{if(event.key==="Escape"){setSelected("");}}}>
      <div className="inspector-title"><span>{secret.key}</span><button type="button" className="icon-button" aria-label="Close secret inspector" onClick={()=>setSelected("")}><X size={14}/></button></div>
      <div className="project-tabs mt-0 mb-4" role="tablist" aria-label="Secret details"><button type="button" role="tab" aria-selected={tab==="details"} onClick={()=>setTab("details")}>Details</button><button type="button" role="tab" aria-selected={tab==="history"} onClick={()=>setTab("history")}>History</button></div>
      {tab==="history"?<InspectorHistory projectId={projectId} environmentId={environment.id} secretId={secret.id}/>:<>
        <SecretReveal key={secret.id} projectId={projectId} environmentId={environment.id} secretKey={secret.key} production={environment.type==="production"}/>
        <dl className="inspector-meta"><dt>Fingerprint</dt><dd className="font-mono">{fingerprints.find(entry=>entry.secret_id===secret.id)?.fingerprint??"Unavailable"}</dd><dt>Environment</dt><dd className="flex items-center gap-2"><i className={"dot "+environment.type}/>{environment.name}</dd><dt>Last updated</dt><dd>{new Date(secret.updated_at).toISOString().replace("T"," ").slice(0,16)} UTC</dd><dt>Description</dt><dd>{secret.description||"No description"}</dd><dt>Required key</dt><dd>{secret.is_required?"Yes":"No"}</dd></dl>
        <RotationEditor key={secret.id} projectId={projectId} secretId={secret.id} canEdit={canWrite(role)}/>
        <div className="inspector-actions">{canWrite(role)&&<><Link href={base+"/secrets/"+secret.id+"/edit"} className="btn-outline"><Pencil size={11}/>Update / rotate</Link><button type="button" className="btn-outline" onClick={()=>onPromote(secret)}><ArrowUpRight size={11}/>Promote</button></>}<Link href={base+"/secrets/"+secret.id+"/history"} className="btn-outline"><History size={11}/>Full history</Link>{canManage(role)&&<button type="button" className="btn-outline text-destructive" onClick={()=>{setRemove(true);setError("");}}>Delete</button>}</div>
      </>}
    </aside>}
    </div>
    {remove&&secret&&<Dialog title="Delete secret" onClose={()=>{if(!busy)setRemove(false);}}><p className="mb-4 text-xs text-muted-foreground">This permanently deletes {secret.key} and its versions from {environment.name}. Type the key to confirm.</p><input data-autofocus className="auth-input" aria-label="Confirm secret key" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} disabled={busy}/>{error&&<p className="inline-error mt-3" role="alert">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy} onClick={()=>setRemove(false)}>Cancel</button><button type="button" className="btn-outline text-destructive" disabled={busy||confirmation!==secret.key} onClick={()=>void deleteSecret()}>{busy?"Deleting…":"Delete permanently"}</button></div></Dialog>}
  </>;
}
