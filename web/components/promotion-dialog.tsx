"use client";
import { useSecretMutation } from "@/components/use-secret-mutation";
import { useRef, useState } from "react";
import { ArrowDown, Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/dialog";
import { readSecret } from "@/components/secret-reveal";
import { useEffect } from "react";

export function PromotionDialog({projectId,secretKey,source,environments,initialTarget,onClose}:{projectId:string;secretKey:string;source:{id:string;name:string};environments:{id:string;name:string;type:string}[];initialTarget?:string;onClose:()=>void}){
  const mutation=useSecretMutation();
  const [pending,setPending]=useState(false);
  const targets=environments.filter(environment=>environment.id!==source.id);
  const [target,setTarget]=useState(initialTarget??targets[0]?.id??"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState(false);
  const router=useRouter();
  const active=useRef(true);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;request.current?.abort();};},[]);
  async function promote(){
    setBusy(true);setError("");
    const controller=new AbortController();request.current=controller;
    try{
      const value=await readSecret(projectId,source.id,secretKey,controller.signal);
      if(!active.current||controller.signal.aborted)return;
      const response=await mutation.request("/api/browser-cli",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({project:projectId,environment:target,key:secretKey,value}),signal:controller.signal});
      if(!response.ok)throw new Error();
      const data=await response.json();setPending(!!data.pending);
      if(active.current){setDone(true);router.refresh();}
    }catch{if(active.current&&!controller.signal.aborted)setError("Promotion could not be completed. Check your connection and project write permissions.");}
    finally{if(active.current)setBusy(false);}
  }
  const destination=targets.find(environment=>environment.id===target);
  return <>{mutation.confirmation}<Dialog title={done?(pending?"Approval requested":"Secret promoted"):"Promote secret"} onClose={()=>{if(!busy)onClose();}}>
    {done?<div className="flex items-center gap-2 text-xs"><Check size={15} className="text-primary"/>{pending?"A different project owner or admin must approve this change in Activity.":secretKey+" is now in "+destination?.name+"."}</div>:<><p className="mb-4 break-all font-mono text-xs">{secretKey}</p><div className="surface-card p-3 text-xs"><p className="text-[10px] text-muted-foreground">Source environment</p><p className="mt-2">{source.name}</p><span className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"><Lock size={10}/>Value stays hidden</span></div><ArrowDown size={16} className="mx-auto my-3 text-muted-foreground"/><label className="block text-xs text-muted-foreground">Destination<select data-autofocus value={target} onChange={event=>setTarget(event.target.value)} disabled={busy} className="mt-2 w-full rounded border bg-background p-2">{targets.map(environment=><option value={environment.id} key={environment.id}>{environment.name}</option>)}</select></label><p className={"mt-4 text-xs "+(destination?.type==="production"?"text-destructive":"text-muted-foreground")}>Confirm copying this sensitive value to {destination?.name}. An existing key receives a new version; other keys are unchanged.</p></>}
    {error&&<p className="inline-error mt-4" role="alert">{error}</p>}
    <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy} onClick={onClose}>{done?"Done":"Cancel"}</button>{!done&&<button type="button" className="btn-accent" disabled={busy||!target} onClick={()=>void promote()}>{busy?"Promoting…":"Promote to "+(destination?.name??"environment")}</button>}</div>
  </Dialog></>;
}
