"use client";
import { FormEvent,useCallback,useEffect,useState } from "react";
import { Filter,ArrowDownToLine,X,ScrollText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type AuditEvent={id:string;action:string;actor_id:string|null;token_id:string|null;created_at:string;resource_type:string|null;resource_id?:string|null;project_id:string|null;environment_id:string|null;ip_address:string|null};
type Member={user_id:string;full_name:string|null};
type Project={id:string;name:string};
export function AuditViewer({teamId,projectId}:{teamId:string;projectId?:string}){
  const [events,setEvents]=useState<AuditEvent[]>([]),[members,setMembers]=useState<Member[]>([]),[projects,setProjects]=useState<Project[]>([]);
  const [query,setQuery]=useState(""),[page,setPage]=useState(0),[total,setTotal]=useState(0),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [detail,setDetail]=useState<AuditEvent|null>(null);
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/v1/audit?team_id="+encodeURIComponent(teamId)+"&page="+page+"&"+query+(projectId?"&project_id="+encodeURIComponent(projectId):""),{signal,cache:"no-store"});
      if(!response.ok)throw new Error();
      const data=await response.json();setEvents(data.events);setTotal(data.total);
    }catch{if(!signal.aborted)setError("Activity could not be loaded. Check the filters and try again.");}
    finally{if(!signal.aborted)setLoading(false);}
  },[teamId,projectId,page,query]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/v1/teams/"+teamId+"/members",{signal:controller.signal,cache:"no-store"}).then(async response=>{if(response.ok){const data=await response.json();setMembers(data.members??[]);}}).catch(()=>{});
    fetch("/api/browser-cli?action=projects",{signal:controller.signal,cache:"no-store"}).then(async response=>{if(response.ok){const data=await response.json();setProjects(data.items??[]);}}).catch(()=>{});
    return()=>controller.abort();
  },[teamId]);
  function filter(event:FormEvent<HTMLFormElement>){
    event.preventDefault();const params=new URLSearchParams();
    for(const[key,value]of new FormData(event.currentTarget))if(typeof value==="string"&&value.trim())params.set(key,key==="to"?value+"T23:59:59.999Z":value.trim());
    setPage(0);setQuery(params.toString());setDetail(null);
  }
  const actor=(event:AuditEvent)=>members.find(member=>member.user_id===event.actor_id)?.full_name||(event.actor_id?"Member "+event.actor_id.slice(0,6):event.token_id?"API token":"System");
  const scope=(event:AuditEvent)=>projects.find(project=>project.id===event.project_id)?.name??(event.project_id?"Project "+event.project_id.slice(0,6):"Workspace");
  return <div>
    <form onSubmit={filter} className="mb-5 space-y-3"><div className="flex flex-wrap items-end gap-2"><label className="text-[10px] text-muted-foreground">Activity<input className="auth-input !mt-1 !h-8 !w-40" name="action" placeholder="All activity"/></label><label className="text-[10px] text-muted-foreground">Member<select className="auth-input !mt-1 !h-8 !w-40" name="actor_id"><option value="">All members</option>{members.map(member=><option key={member.user_id} value={member.user_id}>{member.full_name||member.user_id.slice(0,8)}</option>)}</select></label>{!projectId&&<label className="text-[10px] text-muted-foreground">Project<select name="project_id" className="auth-input !mt-1 !h-8 !w-40"><option value="">All projects</option>{projects.map(project=><option value={project.id} key={project.id}>{project.name}</option>)}</select></label>}<button type="submit" className="btn-outline" disabled={loading}><Filter size={12}/>Apply</button></div><details className="text-xs text-muted-foreground"><summary className="cursor-pointer text-[10px]">Date range and IDs</summary><div className="mt-3 grid gap-3 sm:grid-cols-3">{[["from","From (UTC)","date"],["to","To (UTC)","date"],["token_id","Token ID","text"],["environment_id","Environment ID","text"]].map(([name,label,type])=><label key={name} className="text-[10px]">{label}<input className="auth-input !h-8" type={type} name={name}/></label>)}</div></details></form>
    <div className="mb-3 flex items-center justify-between"><p className="text-[11px] text-muted-foreground">{total} events · times in UTC</p><a className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground" href={"/api/v1/audit?team_id="+encodeURIComponent(teamId)+"&format=csv&"+query+(projectId?"&project_id="+encodeURIComponent(projectId):"")}><ArrowDownToLine size={12}/>Export latest 1,000</a></div>
    {error?<p className="inline-error" role="alert">{error}</p>:loading?<div className="surface-card">{[1,2,3,4].map(index=><div className="skeleton-row" key={index}><div className="skeleton w-2/3"/></div>)}</div>:!events.length?<EmptyState title="No matching activity" description="Workspace events and secret access will appear here. Try adjusting the filters."/>:<div className="surface-card px-3">{events.map((event,index)=><div key={event.id}>{(index===0||event.created_at.slice(0,10)!==events[index-1].created_at.slice(0,10))&&<p className="border-b border-border py-3 text-[10px] text-muted-foreground">{event.created_at.slice(0,10)}</p>}<button type="button" className="audit-row" onClick={()=>setDetail(event)}><time className="audit-time">{event.created_at.slice(11,16)}</time><span className="avatar">{actor(event)[0]?.toUpperCase()}</span><span className="min-w-0"><span className="font-medium">{actor(event)}</span><span className="ml-2 text-muted-foreground">{event.action.replaceAll("."," · ").replaceAll("_"," ")}</span></span><span className="audit-scope">{scope(event)}{event.token_id?" · API token":""}</span></button></div>)}</div>}
    <div className="mt-4 flex justify-end gap-3"><button type="button" className="btn-outline" disabled={loading||page===0} onClick={()=>{setPage(page-1);setDetail(null);}}>Previous</button><span className="self-center text-[11px] text-muted-foreground">Page {page+1}</span><button type="button" className="btn-outline" disabled={loading||(page+1)*50>=total} onClick={()=>{setPage(page+1);setDetail(null);}}>Next</button></div>
    {detail&&<aside className="audit-detail" aria-label="Audit event details"><div className="inspector-title"><span className="flex items-center gap-2"><ScrollText size={13}/>Event details</span><button type="button" className="icon-button" aria-label="Close event details" onClick={()=>setDetail(null)}><X size={13}/></button></div><p className="break-all font-mono text-xs">{detail.action}</p><dl className="inspector-meta">{[["When",new Date(detail.created_at).toISOString()],["Actor",actor(detail)],["Actor ID",detail.actor_id],["Token ID",detail.token_id],["Project",scope(detail)],["Project ID",detail.project_id],["Environment ID",detail.environment_id],["Resource type",detail.resource_type],["Resource ID",detail.resource_id],["IP address",detail.ip_address]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value??"—"}</dd></div>)}</dl></aside>}
  </div>;
}
