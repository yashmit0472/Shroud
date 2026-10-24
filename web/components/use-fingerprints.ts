"use client";
import { useEffect,useState } from "react";
export type Fingerprint={secret_id:string;key:string;environment_id:string;fingerprint:string|null;state:"matching"|"different"|"unreadable"};
export function useFingerprints(projectId:string,version:string){
 const [entries,setEntries]=useState<Fingerprint[]>([]),[available,setAvailable]=useState(false);
 useEffect(()=>{const controller=new AbortController();fetch("/api/projects/"+projectId+"/fingerprints",{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();if(!controller.signal.aborted){setEntries(data.entries);setAvailable(true);}}).catch(()=>{if(!controller.signal.aborted){setEntries([]);setAvailable(false);}});return()=>controller.abort();},[projectId,version]);
 return {entries,available};
}
