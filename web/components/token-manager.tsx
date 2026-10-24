"use client";
import { FormEvent,useCallback,useEffect,useRef,useState } from "react";
import { usePathname,useRouter,useSearchParams } from "next/navigation";
import { Plus,KeyRound,Check,Copy,Shield } from "lucide-react";
import { Dialog } from "@/components/dialog";
import { EmptyState } from "@/components/empty-state";

type Token={id:string;name:string;token_prefix:string;scopes:string[];expires_at:string|null;created_at:string;last_used_at:string|null;revoked_at:string|null};
export function TokenManager({teamId}:{teamId:string}){
  const router=useRouter(),pathname=usePathname(),search=useSearchParams();
  const [tokens,setTokens]=useState<Token[]>([]);
  const [name,setName]=useState(""),[days,setDays]=useState("30"),[write,setWrite]=useState(false),[secret,setSecret]=useState("");
  const [error,setError]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[copied,setCopied]=useState(false);
  const [revokeId,setRevokeId]=useState<string|null>(null);
  const [now,setNow]=useState(0);
  const copyTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const load=useCallback(async()=>{
    const response=await fetch("/api/v1/tokens?team_id="+encodeURIComponent(teamId),{cache:"no-store"});
    if(!response.ok)throw new Error("Tokens could not be loaded. Please try again.");
    const data=await response.json();setTokens(data.tokens);setNow(Date.now());
  },[teamId]);
  useEffect(()=>{load().catch(()=>setError("Tokens could not be loaded. Refresh to try again.")).finally(()=>setLoading(false));return()=>{if(copyTimer.current)clearTimeout(copyTimer.current);};},[load]);
  function close(){
    if(busy)return;
    setOpen(false);setSecret("");setCopied(false);setError("");
    if(search.has("create"))router.replace(pathname);
  }
  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError("");setSecret("");
    try{
      const response=await fetch("/api/v1/tokens",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({team_id:teamId,name,scopes:write?["secrets:read","secrets:write"]:["secrets:read"],expires_at:new Date(Date.now()+Number(days)*86400000).toISOString()})});
      if(!response.ok)throw new Error();
      const data=await response.json();setSecret(data.secret);setName("");
      await load();
    }catch{setError("Token could not be created or the list refreshed. Check your permissions and connection.");}
    finally{setBusy(false);}
  }
  async function revoke(){
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/v1/tokens/"+revokeId+"?team_id="+encodeURIComponent(teamId),{method:"DELETE"});
      if(!response.ok)throw new Error();
      setRevokeId(null);await load();
    }catch{setError("Token could not be revoked. Check your connection and permissions.");}
    finally{setBusy(false);}
  }
  async function copy(){
    try{await navigator.clipboard.writeText(secret);setCopied(true);copyTimer.current=setTimeout(()=>setCopied(false),1800);}
    catch{setError("Copy failed. Select and copy the token manually.");}
  }
  return <div>
    <div className="mb-5 flex items-center justify-between"><span className="flex items-center gap-2 text-xs text-muted-foreground"><Shield size={13}/>{tokens.length} workspace tokens</span><button type="button" className="btn-accent" onClick={()=>{setOpen(true);setError("");}}><Plus size={12}/>Create token</button></div>
    {error&&!open&&!search.has("create")&&!revokeId&&<p className="inline-error mb-4" role="alert">{error}</p>}
    {loading?<div className="surface-card">{[1,2,3].map(index=><div className="skeleton-row" key={index}><div className="skeleton w-1/2"/></div>)}</div>:tokens.length?tokens.map(token=>{
      const expired=!!token.expires_at&&Date.parse(token.expires_at)<=now;
      const inactive=expired||!!token.revoked_at;
      const soon=!inactive&&!!token.expires_at&&Date.parse(token.expires_at)-now<7*86400000;
      return <article className={"token-row"+(inactive?" inactive":"")} key={token.id}>
        <div><p className="flex items-center gap-2 font-medium"><KeyRound size={13} className="text-muted-foreground"/>{token.name}</p><p className="font-mono text-[10px] text-muted-foreground">{token.token_prefix} · ••••••••••••</p><p className="meta">{token.scopes.join(" · ")}</p></div>
        <div><span className="meta">Last used</span><p className="text-[11px]">{token.last_used_at?new Date(token.last_used_at).toLocaleDateString():"Never"}</p><p className="meta">Created {new Date(token.created_at).toLocaleDateString()}</p></div>
        <div><span className="meta">{token.revoked_at?"Status":expired?"Expired":"Expires"}</span><p className={"text-[11px] "+(expired?"text-destructive":soon?"text-amber-300":"")}>{token.revoked_at?"Revoked":token.expires_at?new Date(token.expires_at).toLocaleDateString():"Never"}</p><p className={"meta "+(soon?"!text-amber-300":"")}>{soon?"Expires within 7 days":inactive?"Inactive":"Active"}</p></div>
        <button type="button" className="btn-outline text-destructive" disabled={busy||!!token.revoked_at} onClick={()=>{setError("");setRevokeId(token.id);}}>Revoke</button>
      </article>;
    }):<EmptyState title="No API tokens" description="Create a scoped token for the optional desktop CLI or your CI workflow."/>}
    {(open||search.get("create")==="1")&&<Dialog title={secret?"Copy this token now":"Create API token"} onClose={close}>
      {secret?<div><p className="mb-4 text-xs text-muted-foreground">You will not be able to view it again. Store it in your password manager or CI secret store.</p><code className="block select-all break-all rounded border border-border bg-background p-3 text-xs">{secret}</code><div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" onClick={()=>void copy()}>{copied?<Check size={12}/>:<Copy size={12}/>} {copied?"Copied":"Copy token"}</button><button type="button" className="btn-accent" disabled={busy} onClick={close}>Done</button></div></div>:<form onSubmit={create} className="space-y-4"><label className="auth-label">Token name<input data-autofocus className="auth-input" value={name} onChange={event=>setName(event.target.value)} placeholder="Production CI" maxLength={100} required disabled={busy}/></label><label className="auth-label">Expires after<select className="auth-input" value={days} onChange={event=>setDays(event.target.value)} disabled={busy}>{[["7","7 days"],["30","30 days"],["90","90 days"],["365","1 year"]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={write} onChange={event=>setWrite(event.target.checked)} disabled={busy}/>Allow writes · read access included</label><p className="text-[11px] text-muted-foreground">Read-only tokens can pull variables and inject them into local processes.</p><div className="flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy} onClick={close}>Cancel</button><button type="submit" className="btn-accent" disabled={busy||loading}>{busy?"Creating…":"Create token"}</button></div></form>}
      {error&&<p className="inline-error mt-4" role="alert">{error}</p>}
    </Dialog>}
    {revokeId&&<Dialog title="Revoke API token" onClose={()=>{if(!busy)setRevokeId(null);}}><p className="text-xs text-muted-foreground">Clients using this token will immediately lose access. This cannot be undone.</p>{error&&<p className="inline-error mt-4" role="alert">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" className="btn-outline" disabled={busy} onClick={()=>setRevokeId(null)}>Cancel</button><button type="button" className="btn-outline text-destructive" disabled={busy} onClick={()=>void revoke()}>{busy?"Revoking…":"Confirm revoke"}</button></div></Dialog>}
  </div>;
}
