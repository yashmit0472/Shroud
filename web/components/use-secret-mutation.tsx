"use client";
import { useEffect,useRef,useState } from "react";
import { Dialog } from "@/components/dialog";

export function useSecretMutation(){
 const [open,setOpen]=useState(false),[typed,setTyped]=useState("");
 const resolve=useRef<((approved:boolean)=>void)|null>(null);
 useEffect(()=>()=>{resolve.current?.(false);},[]);
 function finish(approved:boolean){resolve.current?.(approved);resolve.current=null;setOpen(false);setTyped("");}
 async function request(url:string,options:RequestInit){
  let response=await fetch(url,options);
  if(response.status!==409)return response;
  let problem;try{problem=await response.clone().json();}catch{return response;}
  if(problem.code!=="P0400")return response;
  const approved=await new Promise<boolean>(done=>{resolve.current=done;setOpen(true);setTyped("");});
  if(!approved)return Response.json({error:"Production change cancelled."},{status:409});
  let body;try{body=typeof options.body==="string"?JSON.parse(options.body):{};}catch{return Response.json({error:"Invalid change request."},{status:400});}
  response=await fetch(url,{...options,headers:{...options.headers,"Content-Type":"application/json"},body:JSON.stringify({...body,confirm_production:true})});
  return response;
 }
 const confirmation=open?<Dialog title="Confirm Production change" onClose={()=>finish(false)}><p className="text-xs text-destructive">This changes Production configuration. If approval is enabled, your change will wait for a different project owner or admin.</p><label className="auth-label mt-4">Type Production to continue<input data-autofocus className="auth-input" value={typed} onChange={event=>setTyped(event.target.value)} autoComplete="off"/></label><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" onClick={()=>finish(false)}>Cancel</button><button type="button" className="btn-accent" disabled={typed!=="Production"} onClick={()=>finish(true)}>Confirm Production</button></div></Dialog>:null;
 return {request,confirmation};
}
