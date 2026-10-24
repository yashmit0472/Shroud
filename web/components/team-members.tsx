"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import Image from "next/image";
import { Copy,Check,Plus,Trash2,UserRound,Link2 } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";

type TeamRole="owner"|"admin"|"developer"|"viewer";
type Member={id:string;user_id:string;full_name:string|null;avatar_url:string|null;role:TeamRole;created_at:string};
type Invitation={id:string;role:TeamRole;expires_at:string;created_at:string;invited_by:string};
export function TeamMembers({teamId,currentUserId,currentUserRole}:{teamId:string;currentUserId:string;currentUserRole:TeamRole}){
  const router=useRouter(),pathname=usePathname(),search=useSearchParams();
  const [members,setMembers]=useState<Member[]>([]),[invitations,setInvitations]=useState<Invitation[]>([]);
  const [loading,setLoading]=useState(true),[inviteOpen,setInviteOpen]=useState(false),[error,setError]=useState(""),[removing,setRemoving]=useState<Member|null>(null),[busy,setBusy]=useState(false);
  const canManage=currentUserRole==="owner"||currentUserRole==="admin";
  const loadTeam=useCallback(async()=>{
    setLoading(true);
    try{
      const [membersResponse,invitationsResponse]=await Promise.all([fetch("/api/v1/teams/"+teamId+"/members",{cache:"no-store"}),canManage?fetch("/api/v1/teams/"+teamId+"/invitations",{cache:"no-store"}):Promise.resolve(null)]);
      if(!membersResponse.ok)throw new Error();
      const data=await membersResponse.json();setMembers(data.members??[]);
      if(invitationsResponse){if(!invitationsResponse.ok)throw new Error();const data=await invitationsResponse.json();setInvitations(data.invitations??[]);}
    }catch{setError("Team details could not be loaded. Check your connection and try again.");}
    finally{setLoading(false);}
  },[teamId,canManage]);
  useEffect(()=>{void loadTeam();},[loadTeam]);
  function closeInvite(){setInviteOpen(false);if(search.has("invite"))router.replace(pathname);}
  async function removeMember(){
    if(!removing)return;
    setBusy(true);setError("");
    try{const response=await fetch("/api/v1/teams/"+teamId+"/members/"+removing.user_id,{method:"DELETE"});if(!response.ok)throw new Error();setMembers(current=>current.filter(member=>member.user_id!==removing.user_id));setRemoving(null);}
    catch{setError("This member could not be removed. Check your role and connection.");}
    finally{setBusy(false);}
  }
  return <div><div className="mb-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{members.length} members · Your role: {currentUserRole}</span>{canManage&&<button type="button" className="btn-accent" onClick={()=>setInviteOpen(true)}><Plus size={12}/>Create invitation link</button>}</div>
    {error&&<p className="inline-error mb-4" role="alert">{error}</p>}
    {loading?<div className="surface-card">{[1,2,3].map(index=><div className="skeleton-row" key={index}><div className="skeleton w-1/2"/></div>)}</div>:members.length?<div className="surface-card divide-y divide-border">{members.map(member=><div key={member.id} className="flex items-center gap-3 px-4 py-3"><span className="avatar overflow-hidden">{member.avatar_url?<Image src={member.avatar_url} width={27} height={27} alt="" unoptimized className="size-full object-cover"/>:<UserRound size={13}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{member.full_name||"Unnamed member"}{member.user_id===currentUserId&&<span className="ml-2 text-[10px] text-muted-foreground">You</span>}</p><p className="mt-1 text-[10px] text-muted-foreground">Joined {new Date(member.created_at).toLocaleDateString()}</p></div><span className="rounded border border-border px-2 py-1 text-[10px] capitalize text-muted-foreground">{member.role}</span>{canManage&&member.user_id!==currentUserId&&member.role!=="owner"&&(currentUserRole==="owner"||member.role!=="admin")&&<button type="button" aria-label={"Remove "+(member.full_name||"member")} className="icon-button hover:text-destructive" onClick={()=>{setError("");setRemoving(member);}}><Trash2 size={12}/></button>}</div>)}</div>:<EmptyState title="No members found" description="Workspace membership could not be found in the current list."/>}
    {!canManage&&<p className="mt-4 text-[11px] text-muted-foreground">Workspace owners and admins can create invitation links.</p>}
    {canManage&&<><div className="section-label"><span>Pending invitations</span><span className="text-[10px] text-muted-foreground">{invitations.length}</span></div>{invitations.length?<div className="surface-card divide-y divide-border">{invitations.map(invitation=><div key={invitation.id} className="flex items-center gap-3 px-4 py-3"><Link2 size={13} className="text-muted-foreground"/><div className="flex-1"><p className="text-xs">Workspace invitation</p><p className="mt-1 text-[10px] text-muted-foreground">Expires {new Date(invitation.expires_at).toLocaleDateString()}</p></div><span className="text-[10px] capitalize text-muted-foreground">{invitation.role}</span></div>)}</div>:<p className="text-xs text-muted-foreground">No pending invitations. Generate a link to bring a teammate in.</p>}</>}
    {canManage&&(inviteOpen||search.get("invite")==="1")&&<InviteMemberModal teamId={teamId} onClose={closeInvite} onCreated={loadTeam}/>}
    {removing&&<Dialog title="Remove workspace member" onClose={()=>{if(!busy)setRemoving(null);}}><p className="text-xs text-muted-foreground">Remove {removing.full_name||"this member"} from the workspace? Their workspace access will end.</p><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy} onClick={()=>setRemoving(null)}>Cancel</button><button type="button" className="btn-outline text-destructive" disabled={busy} onClick={()=>void removeMember()}>{busy?"Removing…":"Remove member"}</button></div></Dialog>}
  </div>;
}
function InviteMemberModal({teamId,onClose,onCreated}:{teamId:string;onClose:()=>void;onCreated:()=>Promise<void>}){
  const [role,setRole]=useState<"admin"|"developer"|"viewer">("developer"),[expires,setExpires]=useState("7"),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const [result,setResult]=useState<{token:string;invite_code:string}|null>(null);
  async function create(){
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/v1/teams/"+teamId+"/invitations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role,expires_in_days:Number(expires)})});
      if(!response.ok)throw new Error();
      const data=await response.json();setResult({token:data.invitation.token,invite_code:data.invitation.invite_code});await onCreated();
    }catch{setError("Invitation could not be created. Check your permissions and connection.");}
    finally{setLoading(false);}
  }
  const link=result?window.location.origin+"/invite/"+result.token:"";
  return <Dialog title={result?"Invitation created":"Invite to workspace"} onClose={()=>{if(!loading)onClose();}}>
    {result?<><p className="mb-4 text-xs text-muted-foreground">Copy the credentials now. They will not be shown again. Share the full link or token with your teammate.</p><InvitationCredential label="Invitation link" value={link}/><InvitationCredential label="Invitation token" value={result.token}/><details className="mt-3 text-[10px] text-muted-foreground"><summary>Short invite code</summary><p className="my-2">The join form currently requires the full link or token.</p><InvitationCredential label="Code" value={result.invite_code}/></details><div className="mt-5 flex justify-end"><button type="button" className="btn-accent" disabled={loading} onClick={onClose}>Done</button></div></>:<>
      <p className="mb-4 text-xs text-muted-foreground">Choose their workspace role. Project secret access is assigned separately.</p>
      <div className="grid grid-cols-3 gap-2">{[{value:"admin",title:"Admin",description:"Manage workspace"},{value:"developer",title:"Developer",description:"Create projects"},{value:"viewer",title:"Viewer",description:"Read workspace"}].map(item=><button type="button" key={item.value} aria-pressed={role===item.value} className={"rounded border p-3 text-left "+(role===item.value?"border-primary/50 bg-primary/5":"border-border")} disabled={loading} onClick={()=>setRole(item.value as typeof role)}><span className="text-xs">{item.title}</span><span className="mt-2 block text-[10px] text-muted-foreground">{item.description}</span></button>)}</div>
      <label className="auth-label mt-5">Invitation expires<select className="auth-input" value={expires} onChange={event=>setExpires(event.target.value)} disabled={loading}>{[1,7,14,30].map(days=><option key={days} value={days}>{days} {days===1?"day":"days"}</option>)}</select></label>
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={loading} onClick={onClose}>Cancel</button><button type="button" className="btn-accent" disabled={loading} onClick={()=>void create()}>{loading?"Creating…":"Create invitation"}</button></div>
    </>}
    {error&&<p className="inline-error mt-4" role="alert">{error}</p>}
  </Dialog>;
}
function InvitationCredential({label,value}:{label:string;value:string}){
  const [copied,setCopied]=useState(false),[error,setError]=useState("");
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  async function copy(){try{await navigator.clipboard.writeText(value);setCopied(true);timer.current=setTimeout(()=>setCopied(false),1800);}catch{setError("Copy failed. Select and copy manually.");}}
  return <label className="auth-label mt-4">{label}<div className="mt-2 flex gap-2"><input readOnly value={value} className="auth-input !mt-0 min-w-0 flex-1 !text-[10px]" onFocus={event=>event.target.select()}/><button type="button" aria-label={"Copy "+label} className="btn-outline" onClick={()=>void copy()}>{copied?<Check size={12}/>:<Copy size={12}/>}</button></div>{error&&<span role="alert" className="mt-2 block text-[10px] text-destructive">{error}</span>}</label>;
}
