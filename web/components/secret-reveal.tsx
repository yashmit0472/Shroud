"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, LockKeyhole } from "lucide-react";
import { secretReadErrorMessage } from "@/lib/secret-read-errors";

class SecretReadError extends Error {}

export async function readSecret(project:string,environment:string,key:string,signal?:AbortSignal):Promise<string> {
  const search=new URLSearchParams({action:"pull",project,environment,key});
  const response=await fetch("/api/browser-cli?"+search,{cache:"no-store",signal});
  const data=await response.json();
  if(!response.ok)throw new SecretReadError(secretReadErrorMessage(data.code,response.status));
  if(typeof data.items?.[0]?.value!=="string")throw new SecretReadError("The secret has no readable value.");
  return data.items[0].value;
}
export function SecretReveal({projectId,environmentId,secretKey,production}:{projectId:string;environmentId:string;secretKey:string;production:boolean}){
  const [value,setValue]=useState("");
  const [revealed,setRevealed]=useState(false);
  const [pending,setPending]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const held=useRef(false);
  const request=useRef<AbortController|null>(null);
  const copyRequest=useRef<AbortController|null>(null);
  const copying=useRef(false);
  const generation=useRef(0);
  const root=useRef<HTMLDivElement>(null);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const hide=useCallback(()=>{
    held.current=false;generation.current++;request.current?.abort();request.current=null;
    setValue("");setRevealed(false);setPending(false);
  },[]);
  const reveal=useCallback(async()=>{
    if(held.current)return;
    held.current=true;setError("");setPending(true);
    const sequence=++generation.current;
    const controller=new AbortController();request.current=controller;
    try{
      const text=await readSecret(projectId,environmentId,secretKey,controller.signal);
      if(held.current&&generation.current===sequence&&!controller.signal.aborted){setValue(text);setRevealed(true);}
    }catch(failure){if(!controller.signal.aborted)setError(failure instanceof SecretReadError ? failure.message : secretReadErrorMessage(undefined));}
    finally{if(generation.current===sequence)setPending(false);}
  },[projectId,environmentId,secretKey]);
  useEffect(()=>{
    function down(event:KeyboardEvent){
      const target=event.target as HTMLElement;
      if(event.code!=="Space"||event.repeat||!root.current?.closest("aside")?.contains(document.activeElement)||target.matches("input,textarea,select,[contenteditable=true]"))return;
      if(production&&!event.metaKey&&!event.ctrlKey)return;
      event.preventDefault();void reveal();
    }
    function up(event:KeyboardEvent){if(event.code==="Space"||(production&&(event.key==="Meta"||event.key==="Control"))){hide();}}
    function blur(){hide();copyRequest.current?.abort();setCopied(false);}
    function visibility(){if(document.hidden)blur();}
    function focus(event:FocusEvent){if(!root.current?.closest("aside")?.contains(event.target as Node))hide();}
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",blur);document.addEventListener("visibilitychange",visibility);
    document.addEventListener("focusin",focus);
    return()=>{held.current=false;request.current?.abort();copyRequest.current?.abort();if(timer.current)clearTimeout(timer.current);window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",visibility);document.removeEventListener("focusin",focus);};
  },[hide,reveal,production]);
  async function copy(){
    if(copying.current)return;
    copying.current=true;setError("");
    const controller=new AbortController();copyRequest.current=controller;
    try{
      const text=await readSecret(projectId,environmentId,secretKey,controller.signal);
      if(controller.signal.aborted)return;
      await navigator.clipboard.writeText(text);
      if(!controller.signal.aborted){setCopied(true);timer.current=setTimeout(()=>setCopied(false),1800);}
    }catch(failure){if(!controller.signal.aborted)setError(failure instanceof SecretReadError ? failure.message : "Copy failed. Hold to reveal and copy manually.");}
    finally{copying.current=false;}
  }
  return <div ref={root}>
    <div className="secret-value" aria-live="off">{revealed?value||"(empty value)":"••••••••••••••••"}</div>
    <button type="button" className="reveal-control" aria-label="Hold to reveal secret" onPointerDown={event=>{event.preventDefault();event.currentTarget.focus();event.currentTarget.setPointerCapture(event.pointerId);void reveal();}} onPointerUp={hide} onPointerCancel={hide} onLostPointerCapture={hide} onBlur={hide}>
      <LockKeyhole size={15}/><span>{pending?"Reading…":production?"Hold Ctrl / Cmd + Space to reveal":"Hold Space to reveal"}</span><span className="text-[10px] text-muted-foreground">Or press and hold here · release to hide</span>
    </button>
    <button type="button" className="btn-outline mt-3" onClick={()=>void copy()}>{copied?<Check size={12}/>:<Copy size={12}/>} {copied?"Copied":"Copy value"}</button>
    {error&&<p className="inline-error mt-3" role="alert">{error}</p>}
  </div>;
}
