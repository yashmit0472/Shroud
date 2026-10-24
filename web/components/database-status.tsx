"use client";
import { useEffect,useState } from "react";
export function DatabaseStatus(){
 const [ready,setReady]=useState<boolean|null>(null),[error,setError]=useState("");
 useEffect(()=>{const controller=new AbortController();fetch("/api/setup",{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();setReady(data.ready);}).catch(()=>{if(!controller.signal.aborted)setError("Setup status could not be checked.");});return()=>controller.abort();},[]);
 return <section className="surface-card mt-4 p-5"><h2>Database setup</h2>{error?<p className="inline-error mt-3">{error}</p>:ready===null?<div className="skeleton mt-3 w-40"/>:<p className={"mt-3 text-xs "+(ready?"text-primary":"text-amber-300")}>{ready?"Required database functions are installed.":"Database setup is incomplete. The host administrator must apply the installer."}</p>}<p className="mt-2 text-xs text-muted-foreground">The installer supports fresh and existing Shroud databases and can be run again safely.</p><div className="mt-4 flex gap-2"><a href="/downloads/shroud-install.sql" download className="btn-outline">Download setup SQL</a><a href="/docs#database-setup" className="btn-outline">Setup guide</a></div></section>;
}
