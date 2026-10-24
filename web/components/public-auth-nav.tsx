"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuthStatus } from "@/components/auth-session-provider";

export function PublicAuthNav({compact=false}:{compact?:boolean}){
  const status=useAuthStatus();
  return <div className="flex items-center gap-2">
    {status==="signed-out"?<>
      <Link href="/login" className={compact?"btn-accent min-h-0 px-3 py-2 text-xs":"btn-outline"}>Sign in</Link>
      {!compact&&<Link href="/auth/sign-up" className="btn-accent">Get started</Link>}
    </>:<Link href="/dashboard" className={compact?"btn-accent min-h-0 px-3 py-2 text-xs":"btn-accent"}>{status==="signed-in"?"Open dashboard":"Open Shroud"}<ArrowRight size={13}/></Link>}
  </div>;
}

export function SessionAction({guestLabel,guestHref,memberLabel="Open dashboard",memberHref="/dashboard",className,arrow=false}:{guestLabel:string;guestHref:string;memberLabel?:string;memberHref?:string;className?:string;arrow?:boolean}){
  const status=useAuthStatus();
  // While restoring a session, /dashboard lets the server route appropriately.
  const guest=status==="signed-out";
  return <Link href={guest?guestHref:memberHref} className={className}>{guest?guestLabel:status==="checking"?"Open Shroud":memberLabel}{arrow&&<ArrowRight size={13}/>}</Link>;
}
