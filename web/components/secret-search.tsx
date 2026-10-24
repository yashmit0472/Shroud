"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { Search,FileKey2,ArrowUpRight } from "lucide-react";
type Match={id:string;key:string;project_id:string;project_name:string;environment_id:string;environment_name:string;environment_slug:string};
export function SecretSearch(){
 const [query,setQuery]=useState(""),[items,setItems]=useState<Match[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  const timer=setTimeout(async()=>{
   if(query.trim().length<2){setItems([]);setError("");setLoading(false);return;}
   setLoading(true);setError("");
   try{const response=await fetch("/api/search?q="+encodeURIComponent(query),{cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json();if(!controller.signal.aborted)setItems(data.items);}
   catch{if(!controller.signal.aborted)setError("Search could not be loaded. Check your connection and try again.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  },220);
  return()=>{clearTimeout(timer);controller.abort();};
 },[query]);
 return <div><label className="search-field mb-5 max-w-2xl"><Search size={14}/><input aria-label="Search variable names" placeholder="Search variable names across your projects…" value={query} onChange={event=>setQuery(event.target.value)} autoComplete="off"/></label>
  {error?<p className="inline-error" role="alert">{error}</p>:loading?<div className="skeleton w-64"/>:query.trim().length<2?<p className="text-xs text-muted-foreground">Enter at least two characters. Search shows key names and locations; values stay hidden.</p>:items.length?<div className="surface-card divide-y divide-border">{items.map(item=><Link key={item.id} href={"/dashboard/projects/"+item.project_id+"?env="+encodeURIComponent(item.environment_slug)+"&secret="+item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent"><FileKey2 size={14} className="text-muted-foreground"/><span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs">{item.key}</span><span className="mt-1 block text-[10px] text-muted-foreground">{item.project_name} / {item.environment_name}</span></span><ArrowUpRight size={12}/></Link>)}</div>:<div className="empty-state"><strong>No matching keys</strong><p>Try another name or check the selected workspace.</p></div>}
  {items.length===100&&<p className="mt-3 text-[10px] text-muted-foreground">Showing the first 100 matches. Narrow your search to find more.</p>}
 </div>;
}
